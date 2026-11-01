import { ONE_SECOND_RECORDING } from "@zoonk/testing/fixtures/recordings";

export const PRONUNCIATION_RECORDING = ONE_SECOND_RECORDING;

/** @public Next's E2E alias replaces only the paid audio assessment, keeping persistence real. */
export async function assessPronunciation(input: { audio: Uint8Array; expectedText: string }) {
  if (process.env.E2E_TESTING !== "true") {
    throw new Error("The pronunciation test grader is restricted to E2E builds.");
  }

  if (!Buffer.from(input.audio).equals(PRONUNCIATION_RECORDING)) {
    throw new Error("The pronunciation test grader only accepts its fixture recording.");
  }

  return {
    data: {
      transcript: input.expectedText,
      words: [{ heard: null, issue: null, status: "correct", text: input.expectedText }],
    },
  };
}
