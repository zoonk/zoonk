import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { isTestEnvironment } from "./_utils/is-test-environment";

const isTest = isTestEnvironment();

/**
 * Speech models AI Gateway doesn't list are called on their providers directly.
 * Like the gateway, these calls fail before a request leaves the process during
 * tests, so a missed mock never spends credits.
 */
const blockTestFetch: typeof fetch = async () => {
  throw new Error("Direct provider calls are disabled during tests.");
};

export const directOpenAI = createOpenAI({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestFetch : undefined,
});

export const directGoogle = createGoogle({
  apiKey: isTest ? "test-disabled" : process.env.GEMINI_API_KEY,
  fetch: isTest ? blockTestFetch : undefined,
});
