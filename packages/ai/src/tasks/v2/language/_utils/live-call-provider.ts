import { blockTestProviderFetch } from "../../../../_utils/block-test-provider-fetch";
import { isTestEnvironment } from "../../../../_utils/is-test-environment";
import { directOpenAI } from "../../../../direct-providers";

/** Admission can safely pause before reserving money when the OpenAI key is absent. */
export function isLiveCallAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Live calls go to OpenAI directly, not through AI Gateway: the Gateway serves GPT-Live only as a
 * browser WebSocket it can't end or measure from the server, while OpenAI's own API lets our
 * server create the browser's WebRTC session with its instructions and hang it up at the deadline.
 */
export function getLiveCallModel() {
  return directOpenAI.experimental_realtime("gpt-live-1");
}

/** Like the model's own requests, a hangup fails before it leaves the process during tests. */
export const liveCallFetch: typeof fetch = isTestEnvironment() ? blockTestProviderFetch : fetch;
