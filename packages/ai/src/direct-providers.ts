import { createOpenAI } from "@ai-sdk/openai";
import { blockTestProviderFetch } from "./_utils/block-test-provider-fetch";
import { isTestEnvironment } from "./_utils/is-test-environment";
import { blockAiSpendFetch, isAiSpendDisabled } from "./_utils/no-ai-spend";

const isTest = isTestEnvironment();
const noAiSpend = isAiSpendDisabled();

function providerFetch() {
  if (noAiSpend) {
    return blockAiSpendFetch;
  }

  return isTest ? blockTestProviderFetch : undefined;
}

/** Only for what AI Gateway can't serve, such as the GPT-Live call the server hangs up. */
export const directOpenAI = createOpenAI({
  apiKey: isTest || noAiSpend ? "disabled" : undefined,
  fetch: providerFetch(),
});
