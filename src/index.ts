import { config } from "dotenv";
config();
import { ChatOllama } from "@langchain/ollama";
import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  OLLAMA_HOST,
  OLLAMA_MODEL,
  GOOGLE_API_KEY,
  GOOGLE_MODEL,
  BEDROCK_REGION,
  BEDROCK_MODEL_ID,
  BEDROCK_ACCESS_KEY,
  BEDROCK_SECRET_KEY,
} from "./constants";
import { SYSTEM_PROMPT } from "./prompts";

export default async function main(userPrompt: string) {
  let model;
  if (
    BEDROCK_MODEL_ID &&
    BEDROCK_REGION &&
    BEDROCK_ACCESS_KEY &&
    BEDROCK_SECRET_KEY
  ) {
    model = new BedrockChat({
      region: BEDROCK_REGION,
      model: BEDROCK_MODEL_ID,
      credentials: {
        accessKeyId: BEDROCK_ACCESS_KEY,
        secretAccessKey: BEDROCK_SECRET_KEY,
      },
    });
  } else if (GOOGLE_API_KEY && GOOGLE_MODEL) {
    model = new ChatGoogleGenerativeAI({
      apiKey: GOOGLE_API_KEY,
      model: GOOGLE_MODEL,
    });
  } else if (OLLAMA_HOST && OLLAMA_MODEL) {
    model = new ChatOllama({
      baseUrl: OLLAMA_HOST,
      model: OLLAMA_MODEL,
    });
  } else {
    throw new Error(
      "No model configured. Set GEMINI_API_KEY, Bedrock vars, or OLLAMA_HOST and OLLAMA_MODEL.",
    );
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const response = await model.invoke(messages);

  return response;
}

if (require.main === module) {
  main(process.argv[2]);
}
