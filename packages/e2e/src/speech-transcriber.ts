import { PRONUNCIATION_RECORDING } from "./pronunciation-grader";

export {
  NO_SPEECH_CHECK_MODEL,
  type TranscriptionModelId,
} from "../../ai/src/tasks/language/transcribe-speech";

/** @public Next's E2E alias replaces only paid transcription, which hears the fixture recording as speech. */
export async function transcribeSpeech(input: { audio: Uint8Array }) {
  if (process.env.E2E_TESTING !== "true") {
    throw new Error("The test transcriber is restricted to E2E builds.");
  }

  if (!Buffer.from(input.audio).equals(PRONUNCIATION_RECORDING)) {
    throw new Error("The test transcriber only accepts its fixture recording.");
  }

  return { data: { text: "fixture recording" } };
}
