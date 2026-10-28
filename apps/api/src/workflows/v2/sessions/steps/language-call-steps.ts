import {
  prepareCheckpointCall,
  prepareSpeakingMock,
} from "@zoonk/core/language/conversations/prepare";
import { withAiRetry } from "../../_shared/ai-retry";

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
