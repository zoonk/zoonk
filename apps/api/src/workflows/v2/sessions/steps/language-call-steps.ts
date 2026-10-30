import {
  prepareCheckpointCall,
  prepareSpeakingMock,
} from "@zoonk/core/language/conversations/prepare";

export async function prepareLanguageCallsStep(input: {
  goalId: string;
  userId: string;
}): Promise<void> {
  "use step";

  await Promise.all([prepareCheckpointCall(input), prepareSpeakingMock(input)]);
}
