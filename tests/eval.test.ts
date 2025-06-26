import { config } from "dotenv";
config();
import { readFileSync } from "fs";
import { join } from "path";
import { createLLMAsJudge, CORRECTNESS_PROMPT } from "openevals";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import agent from "../src/index";
import { EVALUATOR_MODEL, GOOGLE_API_KEY } from "../src/constants";

const TIMEOUT = 60 * 1000;
jest.setTimeout(TIMEOUT);

interface TestCase {
  name: string;
  input: string;
  referenceOutputs: {
    blurb: string;
  };
}

const testCases: TestCase[] = JSON.parse(
  readFileSync(join(__dirname, "test_cases.json"), "utf-8"),
);

describe("Tech Radar Agent Evals", () => {
  let correctnessEvaluator: ReturnType<typeof createLLMAsJudge>;

  beforeAll(async () => {
    const judge = new ChatGoogleGenerativeAI({
      model: EVALUATOR_MODEL,
      temperature: 0,
      maxOutputTokens: 2048,
      apiKey: GOOGLE_API_KEY,
    });

    correctnessEvaluator = await createLLMAsJudge({
      prompt: CORRECTNESS_PROMPT,
      feedbackKey: "correctness",
      judge,
    });
  });

  testCases.map(({ name, input, referenceOutputs }) => {
    test(name, async () => {
      const outputs = await agent(input);

      const result = await correctnessEvaluator({
        inputs: input,
        outputs: outputs.content,
        referenceOutputs,
      });

      expect(result.score).toBe(true);
    });
  });
});
