export const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:1b";
export const EVALUATOR_MODEL =
  process.env.EVALUATOR_MODEL || "gemini-2.0-flash-lite";
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
export const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.0-flash-lite";
export const BEDROCK_REGION = process.env.BEDROCK_REGION || "";
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "";
export const BEDROCK_ACCESS_KEY = process.env.BEDROCK_ACCESS_KEY || "";
export const BEDROCK_SECRET_KEY = process.env.BEDROCK_SECRET_KEY || "";
