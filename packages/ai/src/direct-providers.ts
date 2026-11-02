import { createOpenAI } from "@ai-sdk/openai";
import { blockTestProviderFetch } from "./_utils/block-test-provider-fetch";
import { isTestEnvironment } from "./_utils/is-test-environment";

const isTest = isTestEnvironment();

/** Only for what AI Gateway can't serve, such as the GPT-Live call the server hangs up. */
export const directOpenAI = createOpenAI({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestProviderFetch : undefined,
});
