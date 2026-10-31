import { checkMistakePattern } from "@zoonk/core/language/patterns/check";
import { voiceWord } from "@zoonk/core/library/language/voice-word";
import { checkFactSensitivity } from "@zoonk/core/memory/fact-sensitivity";
import {
  proposeOnboardingMemory,
  proposeSessionMemory,
  rememberMemoryCandidate,
} from "@zoonk/core/memory/follow-ups";
import {
  type InsightClaim,
  type InsightDay,
  type WrittenInsight,
  claimDailyInsight,
  saveDailyInsight,
  writeDailyInsight,
} from "@zoonk/core/memory/insights/daily";
import { type MemoryGate, gateMemoryCandidate } from "@zoonk/core/memory/remember-candidate";
import { resolveMistakeCause } from "@zoonk/core/mistakes/resolve-cause";

export type ProposedMemory = NonNullable<Awaited<ReturnType<typeof proposeSessionMemory>>>;

type Candidate = ProposedMemory["candidates"][number];

export async function resolveMistakeCauseStep(input: Parameters<typeof resolveMistakeCause>[0]) {
  "use step";
  await resolveMistakeCause(input);
}

export async function checkMistakePatternStep(input: { language: string; userId: string }) {
  "use step";
  await checkMistakePattern(input);
}

export async function checkFactSensitivityStep(input: { factId: string; statement: string }) {
  "use step";
  await checkFactSensitivity(input);
}

export async function voiceWordStep(input: Parameters<typeof voiceWord>[0]) {
  "use step";
  await voiceWord(input);
}

export async function proposeOnboardingMemoryStep(input: {
  goalId: string;
  userId: string;
}): Promise<ProposedMemory | null> {
  "use step";
  return proposeOnboardingMemory(input);
}

export async function proposeSessionMemoryStep(
  input: Parameters<typeof proposeSessionMemory>[0],
): Promise<ProposedMemory | null> {
  "use step";
  return proposeSessionMemory(input);
}

export async function gateMemoryCandidateStep(candidate: Candidate): Promise<MemoryGate | null> {
  "use step";
  return gateMemoryCandidate(candidate);
}

export async function rememberMemoryCandidateStep(
  input: Parameters<typeof rememberMemoryCandidate>[0],
): Promise<void> {
  "use step";
  await rememberMemoryCandidate(input);
}

export async function claimDailyInsightStep(day: InsightDay): Promise<InsightClaim | null> {
  "use step";
  return claimDailyInsight(day);
}

export async function writeDailyInsightStep(
  input: Parameters<typeof writeDailyInsight>[0],
): Promise<WrittenInsight | null> {
  "use step";
  return writeDailyInsight(input);
}

export async function saveDailyInsightStep(input: Parameters<typeof saveDailyInsight>[0]) {
  "use step";
  await saveDailyInsight(input);
}
