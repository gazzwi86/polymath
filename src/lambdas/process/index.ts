import { S3Event, S3EventRecord } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

interface ProcessResult {
  success: boolean;
  message: string;
  processedAt: string;
  originalKey: string;
  processedKey?: string;
  fileSize?: number;
  contentType?: string;
}

export const handler = async (event: S3Event): Promise<void> => {
  console.log("Process lambda triggered", JSON.stringify(event, null, 2));

  try {
    // Process each S3 record in the event
    const processPromises = event.Records.map(async (record: S3EventRecord) => {
      return await processS3Record(record);
    });

    const results = await Promise.allSettled(processPromises);

    // Log results
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(`Record ${index} processed successfully:`, result.value);
      } else {
        console.error(`Record ${index} processing failed:`, result.reason);
      }
    });
  } catch (error) {
    console.error("Process lambda error:", error);
    throw error;
  }
};

async function processS3Record(record: S3EventRecord): Promise<ProcessResult> {
  const bucketName = record.s3.bucket.name;
  const objectKey = decodeURIComponent(
    record.s3.object.key.replace(/\+/g, " "),
  );

  console.log(`Processing file: ${objectKey} from bucket: ${bucketName}`);

  try {
    // Only process files in the uploads folder
    if (!objectKey.startsWith("uploads/")) {
      return {
        success: false,
        message: "File not in uploads folder, skipping",
        processedAt: new Date().toISOString(),
        originalKey: objectKey,
      };
    }

    // Get the file from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const response = await s3Client.send(getObjectCommand);

    if (!response.Body) {
      throw new Error("No file body received from S3");
    }

    // Convert stream to buffer
    const fileBuffer = await streamToBuffer(response.Body);
    const fileSize = fileBuffer.length;
    const contentType = response.ContentType || "application/octet-stream";

    console.log(
      `File details - Size: ${fileSize} bytes, Content-Type: ${contentType}`,
    );

    // Process the file based on its type
    const processedData = await processFileByType(
      fileBuffer,
      contentType,
      objectKey,
    );

    // Save processed data to S3 in processed folder
    const processedKey = objectKey.replace("uploads/", "processed/");
    const metadataKey = processedKey + ".metadata.json";

    // Save the processed file
    if (processedData.processedContent) {
      const putProcessedCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: processedKey,
        Body: processedData.processedContent,
        ContentType: processedData.processedContentType || contentType,
        Metadata: {
          originalKey: objectKey,
          processedAt: new Date().toISOString(),
          processingType: processedData.processingType,
        },
      });

      await s3Client.send(putProcessedCommand);
    }

    // Save metadata about the processing
    const metadata = {
      originalKey: objectKey,
      processedKey: processedData.processedContent ? processedKey : null,
      fileSize: fileSize,
      contentType: contentType,
      processingType: processedData.processingType,
      processedAt: new Date().toISOString(),
      extractedText: processedData.extractedText,
      wordCount: processedData.wordCount,
      success: true,
    };

    const putMetadataCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: metadataKey,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putMetadataCommand);

    return {
      success: true,
      message: `File processed successfully: ${processedData.processingType}`,
      processedAt: new Date().toISOString(),
      originalKey: objectKey,
      processedKey: processedData.processedContent ? processedKey : undefined,
      fileSize: fileSize,
      contentType: contentType,
    };
  } catch (error) {
    console.error(`Error processing file ${objectKey}:`, error);

    // Save error metadata
    try {
      const errorMetadataKey =
        objectKey.replace("uploads/", "processed/") + ".error.json";
      const errorMetadata = {
        originalKey: objectKey,
        error: error instanceof Error ? error.message : "Unknown error",
        processedAt: new Date().toISOString(),
        success: false,
      };

      const putErrorCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: errorMetadataKey,
        Body: JSON.stringify(errorMetadata, null, 2),
        ContentType: "application/json",
      });

      await s3Client.send(putErrorCommand);
    } catch (metadataError) {
      console.error("Failed to save error metadata:", metadataError);
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
      processedAt: new Date().toISOString(),
      originalKey: objectKey,
    };
  }
}

async function processFileByType(
  fileBuffer: Buffer,
  contentType: string,
  fileName: string,
) {
  const processingResult = {
    processingType: "unknown",
    extractedText: "",
    wordCount: 0,
    processedContent: null as Buffer | null,
    processedContentType: null as string | null,
  };

  try {
    switch (contentType) {
      case "text/plain":
      case "text/markdown":
      case "text/x-markdown":
      case "text/csv":
        processingResult.processingType = "text_extraction";
        processingResult.extractedText = fileBuffer.toString("utf-8");
        processingResult.wordCount = processingResult.extractedText
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        break;

      case "application/pdf":
        processingResult.processingType = "pdf_analysis";
        // For PDF processing, you would typically use a library like pdf-parse
        // For now, we'll just note that it's a PDF and store basic info
        processingResult.extractedText = `PDF file detected: ${fileName}`;
        processingResult.wordCount = 0;
        break;

      case "application/rtf": {
        processingResult.processingType = "rtf_analysis";
        // RTF files contain formatting codes, basic text extraction
        const rtfText = fileBuffer.toString("utf-8");
        // Simple RTF text extraction (removes basic RTF codes)
        processingResult.extractedText = rtfText
          .replace(/\\[a-z]+\d*\s?/gi, "")
          .replace(/[{}]/g, "");
        processingResult.wordCount = processingResult.extractedText
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        break;
      }

      case "application/vnd.ms-excel":
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        processingResult.processingType = "spreadsheet_analysis";
        processingResult.extractedText = `Excel file detected: ${fileName}`;
        processingResult.wordCount = 0;
        break;

      case "application/vnd.ms-powerpoint":
      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        processingResult.processingType = "presentation_analysis";
        processingResult.extractedText = `PowerPoint file detected: ${fileName}`;
        processingResult.wordCount = 0;
        break;

      case "application/msword":
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        processingResult.processingType = "document_analysis";
        processingResult.extractedText = `Word document detected: ${fileName}`;
        processingResult.wordCount = 0;
        break;

      default:
        processingResult.processingType = "unknown_format";
        processingResult.extractedText = `Unknown file format: ${contentType}`;
        processingResult.wordCount = 0;
        break;
    }

    // Create a processed summary for text-based files
    if (processingResult.extractedText && processingResult.wordCount > 0) {
      const summary = {
        fileName: fileName,
        contentType: contentType,
        wordCount: processingResult.wordCount,
        characterCount: processingResult.extractedText.length,
        extractedText: processingResult.extractedText.substring(0, 1000), // First 1000 chars
        processedAt: new Date().toISOString(),
      };

      processingResult.processedContent = Buffer.from(
        JSON.stringify(summary, null, 2),
        "utf-8",
      );
      processingResult.processedContentType = "application/json";
    }
  } catch (error) {
    console.error("Error processing file content:", error);
    processingResult.processingType = "processing_error";
    processingResult.extractedText = `Error processing file: ${error instanceof Error ? error.message : "Unknown error"}`;
  }

  return processingResult;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];

  if (stream && typeof stream.transformToByteArray === "function") {
    // AWS SDK v3 Uint8Array stream
    const byteArray = await stream.transformToByteArray();
    return Buffer.from(byteArray);
  }

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
