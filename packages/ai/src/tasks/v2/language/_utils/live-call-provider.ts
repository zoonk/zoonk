import { blockTestProviderFetch } from "../../../../_utils/block-test-provider-fetch";
import { isTestEnvironment } from "../../../../_utils/is-test-environment";
import { directOpenAI } from "../../../../direct-providers";

/** Admission can safely pause before reserving money when the OpenAI key is absent. */
export function isLiveCallAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Not through AI Gateway: it serves GPT-Live only as a browser WebSocket the server can't end or
 * measure, while OpenAI's API lets the server create the WebRTC session and hang it up on time.
 */
export function getLiveCallModel() {
  return directOpenAI.experimental_realtime("gpt-live-1");
}

/** Like the model's own requests, a hangup fails before it leaves the process during tests. */
export const liveCallFetch: typeof fetch = isTestEnvironment() ? blockTestProviderFetch : fetch;
