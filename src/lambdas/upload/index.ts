import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "application/rtf": ".rtf",
  "text/markdown": ".md",
  "text/x-markdown": ".md",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/csv": ".csv",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log("Upload lambda triggered", JSON.stringify(event, null, 2));

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No file data provided" }),
      };
    }

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("S3_BUCKET_NAME environment variable not set");
    }

    // Parse request body
    let fileData: Buffer;
    let fileName: string;
    let contentType: string;

    // Check if it's a direct file upload (base64 encoded)
    if (event.isBase64Encoded) {
      fileData = Buffer.from(event.body, "base64");

      // Get content type from headers
      contentType =
        event.headers["content-type"] ||
        event.headers["Content-Type"] ||
        "application/octet-stream";

      // Get filename from headers or query parameters
      fileName =
        event.queryStringParameters?.filename ||
        event.headers["x-filename"] ||
        event.headers["X-Filename"] ||
        "upload";
    } else {
      // Handle JSON payload with base64 file data
      try {
        const payload = JSON.parse(event.body);

        if (!payload.fileData || !payload.fileName) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: "Missing fileData or fileName in request body",
            }),
          };
        }

        fileData = Buffer.from(payload.fileData, "base64");
        fileName = payload.fileName;
        contentType = payload.contentType || "application/octet-stream";
      } catch {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid JSON in request body" }),
        };
      }
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES[contentType as keyof typeof ALLOWED_FILE_TYPES]) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "File type not allowed",
          allowedTypes: Object.keys(ALLOWED_FILE_TYPES),
          receivedType: contentType,
        }),
      };
    }

    // Store original filename before modification
    const originalFileName = fileName;

    // Generate unique filename
    const timestamp = Date.now();
    const extension =
      ALLOWED_FILE_TYPES[contentType as keyof typeof ALLOWED_FILE_TYPES];

    // Ensure filename has correct extension
    if (!fileName.endsWith(extension)) {
      fileName = fileName.replace(/\.[^/.]+$/, "") + extension;
    }

    const uniqueFileName = `${timestamp}-${fileName}`;
    const s3Key = `uploads/${uniqueFileName}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileData,
      ContentType: contentType,
      Metadata: {
        originalName: originalFileName,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(uploadCommand);

    console.log(`File uploaded successfully: ${s3Key}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "File uploaded successfully",
        fileName: uniqueFileName,
        s3Key: s3Key,
        size: fileData.length,
        contentType: contentType,
      }),
    };
  } catch (error) {
    console.error("Upload error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
