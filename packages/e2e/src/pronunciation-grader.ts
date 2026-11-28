import { ONE_SECOND_RECORDING } from "@zoonk/testing/fixtures/recordings";

/** @public Next's E2E alias for transcription names its no-speech check; the fake answers every model alike. */
export const NO_SPEECH_CHECK_MODEL = "e2e/no-speech-check";

export const PRONUNCIATION_RECORDING = ONE_SECOND_RECORDING;

function assertFixtureRecording(audio: Uint8Array) {
  if (process.env.E2E_TESTING !== "true") {
    throw new Error("The pronunciation test grader is restricted to E2E builds.");
  }

  if (!Buffer.from(audio).equals(PRONUNCIATION_RECORDING)) {
    throw new Error("The pronunciation test grader only accepts its fixture recording.");
  }
}

/** @public Next's E2E alias replaces only the paid audio assessment, keeping persistence real. */
export async function assessPronunciation(input: { audio: Uint8Array; expectedText: string }) {
  assertFixtureRecording(input.audio);

  return {
    data: {
      transcript: input.expectedText,
      words: [{ heard: null, issue: null, status: "correct", text: input.expectedText }],
    },
  };
}

/** @public Next's E2E alias replaces only paid transcription, which hears the fixture recording as speech. */
export async function transcribeSpeech(input: { audio: Uint8Array }) {
  assertFixtureRecording(input.audio);
  return { data: { text: "fixture recording" } };
}
