import { createOpenAI } from "@ai-sdk/openai";
import { isTestEnvironment } from "./_utils/is-test-environment";

const isTest = isTestEnvironment();

/**
 * Models AI Gateway doesn't list (gpt-transcribe, gpt-4o-mini-tts) are called on OpenAI directly.
 * Like the gateway, these calls fail before a request leaves the process during tests, so a
 * missed mock never spends credits.
 */
const blockTestFetch: typeof fetch = async () => {
  throw new Error("Direct provider calls are disabled during tests.");
};

export const directOpenAI = createOpenAI({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestFetch : undefined,
});
