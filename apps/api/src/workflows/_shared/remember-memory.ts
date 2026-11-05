import { type proposeSessionMemory, rememberMemoryCandidate } from "@zoonk/core/memory/follow-ups";
import { type MemoryGate, gateMemoryCandidate } from "@zoonk/core/memory/remember-candidate";

export type ProposedMemory = NonNullable<Awaited<ReturnType<typeof proposeSessionMemory>>>;

type Candidate = ProposedMemory["candidates"][number];

async function gateMemoryCandidateStep(candidate: Candidate): Promise<MemoryGate | null> {
  "use step";
  return gateMemoryCandidate(candidate);
}

async function rememberMemoryCandidateStep(
  input: Parameters<typeof rememberMemoryCandidate>[0],
): Promise<void> {
  "use step";
  await rememberMemoryCandidate(input);
}

async function rememberCandidate({
  candidate,
  context,
}: {
  candidate: Candidate;
  context: ProposedMemory["context"];
}): Promise<void> {
  const gate = await gateMemoryCandidateStep(candidate);

  if (gate) {
    await rememberMemoryCandidateStep({ candidate, context, gate });
  }
}

/** Each candidate sees what the one before it changed. */
export async function rememberProposedMemory(proposed: ProposedMemory | null): Promise<void> {
  if (!proposed) {
    return;
  }

  await proposed.candidates.reduce<Promise<void>>(
    (previous, candidate) =>
      previous.then(() => rememberCandidate({ candidate, context: proposed.context })),
    Promise.resolve(),
  );
}
