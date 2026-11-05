import { proposeCallMemory } from "@zoonk/core/memory/follow-ups";
import { type ProposedMemory } from "../../_shared/remember-memory";

export async function proposeCallMemoryStep(
  input: Parameters<typeof proposeCallMemory>[0],
): Promise<ProposedMemory | null> {
  "use step";
  return proposeCallMemory(input);
}
