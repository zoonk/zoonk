import { rememberProposedMemory } from "../_shared/remember-memory";
import { claimRunToken } from "../_shared/run-token";
import { proposeCallMemoryStep } from "./steps/call-memory-steps";

/** One model call per step: reading the call, then checking and saving each fact it found. */
export async function callMemoryWorkflow(
  input: Parameters<typeof proposeCallMemoryStep>[0],
): Promise<void> {
  "use workflow";

  using claim = await claimRunToken(`call-memory:${input.conversationId}`);

  if (claim.conflict) {
    return;
  }

  await rememberProposedMemory(await proposeCallMemoryStep(input));
}
