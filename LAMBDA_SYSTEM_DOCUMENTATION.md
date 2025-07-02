# AWS Lambda File Upload and Processing System

This document describes the complete serverless file upload and processing system built with AWS Lambda, API Gateway, and S3.

## System Overview

The system consists of two main Lambda functions:

1. **Upload Lambda** (`src/lambdas/upload/`) - Handles file uploads via API Gateway
2. **Process Lambda** (`src/lambdas/process/`) - Processes uploaded files triggered by S3 events

## Architecture

```text
API Gateway (POST /upload) → Upload Lambda → S3 (uploads/) → Process Lambda → S3 (processed/)
```

### Flow Description

1. Client sends a POST request to API Gateway `/upload` endpoint
2. Upload Lambda validates and uploads file to S3 `uploads/` folder
3. S3 upload event triggers Process Lambda
4. Process Lambda analyzes the file and saves results to S3 `processed/` folder

## Upload Lambda (`src/lambdas/upload/index.ts`)

### Functionality

- Accepts file uploads via API Gateway
- Supports multiple file formats: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, RTF, CSV, Markdown
- Validates file types and content
- Uploads files to S3 with unique timestamped names
- Returns upload confirmation with file details

### API Interface

#### Request Format 1: JSON with Base64 Data

```json
POST /upload
Content-Type: application/json

{
  "fileData": "base64-encoded-file-content",
  "fileName": "document.pdf",
  "contentType": "application/pdf"
}
```

#### Request Format 2: Direct Base64 Upload

```http
POST /upload?filename=document.pdf
Content-Type: application/pdf
Body: base64-encoded-file-content
```

#### Response Format

```json
{
  "message": "File uploaded successfully",
  "fileName": "1672531200000-document.pdf",
  "s3Key": "uploads/1672531200000-document.pdf",
  "size": 12345,
  "contentType": "application/pdf"
}
```

### Supported File Types

- **Documents**: PDF, DOC, DOCX, RTF
- **Spreadsheets**: XLS, XLSX, CSV
- **Presentations**: PPT, PPTX
- **Text**: TXT, Markdown

### Environment Variables

- `S3_BUCKET_NAME` - Target S3 bucket for file uploads
- `AWS_REGION` - AWS region (defaults to us-east-1)

## Process Lambda (`src/lambdas/process/index.ts`)

### Functionality

- Triggered by S3 upload events in the `uploads/` folder
- Downloads and analyzes uploaded files
- Extracts text content and metadata
- Saves processing results to `processed/` folder
- Handles errors gracefully with error metadata

### Processing Types

- **Text Extraction**: For TXT, CSV, Markdown, RTF files
- **Document Analysis**: For PDF, DOC, DOCX files
- **Spreadsheet Analysis**: For XLS, XLSX files
- **Presentation Analysis**: For PPT, PPTX files

### Output Structure

#### Processed Files

For text-based files, creates a JSON summary:

```json
{
  "fileName": "document.txt",
  "contentType": "text/plain",
  "wordCount": 150,
  "characterCount": 850,
  "extractedText": "First 1000 characters...",
  "processedAt": "2023-01-01T12:00:00.000Z"
}
```

#### Metadata Files

For all files, creates a metadata JSON:

```json
{
  "originalKey": "uploads/1672531200000-document.pdf",
  "processedKey": "processed/1672531200000-document.pdf",
  "fileSize": 12345,
  "contentType": "application/pdf",
  "processingType": "pdf_analysis",
  "processedAt": "2023-01-01T12:00:00.000Z",
  "extractedText": "PDF file detected: uploads/1672531200000-document.pdf",
  "wordCount": 0,
  "success": true
}
```

#### Error Handling

If processing fails, creates an error metadata file:

```json
{
  "originalKey": "uploads/1672531200000-document.pdf",
  "error": "Error message",
  "processedAt": "2023-01-01T12:00:00.000Z",
  "success": false
}
```

## Testing

### Test Structure

- `src/lambdas/upload/upload.test.ts` - Upload Lambda tests
- `src/lambdas/process/process.test.ts` - Process Lambda tests

### Test Coverage

- CORS handling
- File type validation
- Upload success scenarios
- Error handling
- S3 integration
- Content processing
- Multiple file format support

### Running Tests

```bash
npm test
npm run lint
npm run build
```

## Deployment Considerations

### AWS Resources Required

1. **S3 Bucket** with folders:
   - `uploads/` - For incoming files
   - `processed/` - For processed results

2. **Lambda Functions**:
   - Upload Lambda with API Gateway trigger
   - Process Lambda with S3 event trigger

3. **IAM Permissions**:
   - Upload Lambda: S3 PutObject permissions
   - Process Lambda: S3 GetObject and PutObject permissions

4. **API Gateway**:
   - POST endpoint configured for Upload Lambda
   - CORS enabled for web clients

### Environment Configuration

```bash
# Required environment variables
S3_BUCKET_NAME=your-file-processing-bucket
AWS_REGION=us-east-1
```

### S3 Event Configuration

Configure S3 bucket to trigger Process Lambda on:

- Event: `s3:ObjectCreated:*`
- Prefix: `uploads/`

## Security Features

### Upload Lambda Security

- File type validation using MIME types
- File size limits (configurable)
- CORS headers for web security
- Input validation and sanitization

### Process Lambda Security

- Only processes files in `uploads/` folder
- Error handling prevents information leakage
- Secure file content processing

## Performance Considerations

### Upload Lambda

- Efficient base64 decoding
- Minimal memory usage
- Fast validation

### Process Lambda

- Concurrent processing of multiple files
- Efficient text extraction
- Graceful error handling
- Content truncation for large files (1000 char limit)

## File Format Support Details

### Text Files (.txt, .md, .csv)

- Full text extraction
- Word count analysis
- Character count
- Content summary generation

### RTF Files (.rtf)

- Basic RTF code removal
- Text extraction
- Word count analysis

### Binary Files (.pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx)

- File type detection
- Metadata extraction
- Placeholder for advanced processing
- Ready for integration with specialized libraries

## Future Enhancements

### Potential Improvements

1. **Advanced Text Extraction**:
   - PDF text extraction using pdf-parse
   - Word document processing with mammoth
   - Excel data extraction with xlsx

2. **Content Analysis**:
   - Sentiment analysis
   - Language detection
   - Content classification

3. **Security Enhancements**:
   - Virus scanning
   - Content filtering
   - User authentication

4. **Performance Optimizations**:
   - Parallel processing
   - Caching mechanisms
   - Compression

## Error Handling

### Upload Lambda Errors

- Invalid file types → 400 Bad Request
- Missing environment variables → 500 Internal Server Error
- S3 upload failures → 500 Internal Server Error

### Process Lambda Errors

- S3 access failures → Error metadata saved
- File processing errors → Error metadata saved
- Invalid file content → Graceful degradation

## Monitoring and Logging

### CloudWatch Logs

- Detailed request/response logging
- Error tracking with stack traces
- Performance metrics
- File processing statistics

### Recommended Metrics

- Upload success rate
- Processing completion rate
- Average processing time
- Error frequency by file type

This system provides a robust, scalable foundation for file upload and processing workflows in AWS serverless environments.
