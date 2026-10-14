export const PRONUNCIATION_RECORDING = "zoonk-e2e-pronunciation-recording";

/** @public Next's E2E alias replaces only the paid audio assessment, keeping persistence real. */
export async function assessPronunciation(input: { audio: Uint8Array; expectedText: string }) {
  if (process.env.E2E_TESTING !== "true") {
    throw new Error("The pronunciation test grader is restricted to E2E builds.");
  }

  if (new TextDecoder().decode(input.audio) !== PRONUNCIATION_RECORDING) {
    throw new Error("The pronunciation test grader only accepts its fixture recording.");
  }

  return {
    data: {
      transcript: input.expectedText,
      words: [{ heard: null, issue: null, status: "correct", text: input.expectedText }],
    },
  };
}
