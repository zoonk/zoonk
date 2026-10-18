import {
  prepareCheckpointCall,
  prepareSpeakingMock,
} from "@zoonk/core/language/conversations/prepare";
import { withAiRetry } from "../../_shared/ai-retry";

/**
 * Writes a language goal's next calls ahead, so neither waits on a model when the learner opens
 * it: the call of its next checkpoint (shared by the unit's learners at that level) and, for an
 * IELTS or TOEFL goal, its next speaking mock. Each is written once; other goals get nothing.
 */
export async function prepareLanguageCallsStep(input: {
  goalId: string;
  userId: string;
}): Promise<void> {
  "use step";

  await Promise.all([
    withAiRetry(() => prepareCheckpointCall(input)),
    withAiRetry(() => prepareSpeakingMock(input)),
  ]);
}
