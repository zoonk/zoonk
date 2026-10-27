import { directOpenAI } from "../../../../direct-providers";

/** Admission can safely pause before reserving money when the OpenAI key is absent. */
export function isLiveCallAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Live calls go to OpenAI directly, not through AI Gateway: only OpenAI's own API lets the server
 * create a browser's WebRTC session, hang it up and attach to it.
 */
export function getLiveCallModel() {
  return directOpenAI.experimental_realtime("gpt-live-1");
}
