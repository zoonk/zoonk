import { rememberProposedMemory } from "../_shared/remember-memory";
import { proposeCallMemoryStep } from "./steps/call-memory-steps";

export function getCallMemoryToken(conversationId: string): string {
  return `call-memory:${conversationId}`;
}

/** One model call per step: reading the call, then checking and saving each fact it found. */
export async function callMemoryWorkflow(
  input: Parameters<typeof proposeCallMemoryStep>[0],
): Promise<void> {
  "use workflow";

  await rememberProposedMemory(await proposeCallMemoryStep(input));
}
