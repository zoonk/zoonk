import { blockTestProviderFetch } from "../../../_utils/block-test-provider-fetch";
import { isTestEnvironment } from "../../../_utils/is-test-environment";
import { blockAiSpendFetch, isAiSpendDisabled } from "../../../_utils/no-ai-spend";
import { directOpenAI } from "../../../direct-providers";

export function isLiveCallAvailable(): boolean {
  return !isAiSpendDisabled() && Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Not through AI Gateway: it serves GPT-Live only as a browser WebSocket the server can't end or
 * measure, while OpenAI's API lets the server create the WebRTC session and hang it up on time.
 */
export function getLiveCallModel() {
  return directOpenAI.experimental_realtime("gpt-live-1");
}

function getLiveCallFetch(): typeof fetch {
  if (isAiSpendDisabled()) {
    return blockAiSpendFetch;
  }

  return isTestEnvironment() ? blockTestProviderFetch : fetch;
}

export const liveCallFetch = getLiveCallFetch();
