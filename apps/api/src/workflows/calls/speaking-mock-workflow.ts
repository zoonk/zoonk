import { prepareSpeakingMockStep } from "./steps/conversation-review-steps";

/** Writes the learner's next speaking mock ahead, so another try starts at once. */
export async function speakingMockWorkflow(input: { goalId: string; userId: string }) {
  "use workflow";

  await prepareSpeakingMockStep(input);
}
