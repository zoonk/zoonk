import { type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { listCoreLessonItems } from "../plans/_utils/core-lessons";

export const CHECKPOINT_QUESTIONS = 10;

export const MIN_CHECKPOINT_QUESTIONS = 5;

export const PASS_SHARE = 0.7;

export const REINFORCEMENT_LESSONS = 2;

export const CHECKPOINT_MINUTES_PER_QUESTION = 1.5;

export function getPassMark(questions: number): number {
  return Math.ceil(questions * PASS_SHARE);
}

/** Reserves the full size when missing questions will be written on Start. */
export function getPlannedQuestions(available: number): number {
  return available < MIN_CHECKPOINT_QUESTIONS ? CHECKPOINT_QUESTIONS : available;
}

export function hasPassedCheckpoint({
  correct,
  passMark,
}: {
  correct: number;
  passMark: number;
}): boolean {
  return correct >= passMark;
}

export type CheckpointItemCandidate = {
  hasMisconceptions: boolean;
  id: string;
  seen: boolean;
  skillId: string;
};

function rankCandidate(candidate: CheckpointItemCandidate): number {
  const trapRank = candidate.hasMisconceptions ? 0 : 2;
  const seenRank = candidate.seen ? 1 : 0;

  return trapRank + seenRank;
}

export function selectCheckpointItems({
  candidates,
  skillIds,
}: {
  candidates: readonly CheckpointItemCandidate[];
  skillIds: readonly string[];
}): string[] {
  const perSkill = skillIds.map((skillId) =>
    candidates
      .filter((candidate) => candidate.skillId === skillId)
      .toSorted((a, b) => rankCandidate(a) - rankCandidate(b)),
  );

  return interleave(perSkill)
    .slice(0, CHECKPOINT_QUESTIONS)
    .map((candidate) => candidate.id);
}

type BossPlanItem = {
  id: string | null;
  key?: string;
  chapterId: string | null;
  kind: PlanItemKind;
  lessonId: string | null;
  lessons?: number | null;
  phase: number;
  position: number;
  scheduledFor: Date | null;
  skillId: string | null;
  status?: PlanItemStatus;
};

type BossItem = Pick<BossPlanItem, "phase" | "position" | "scheduledFor">;

type BossPlan = {
  /** plannedLessons sizes the core when available; lessons is the graph's fallback estimate. */
  graphSkills: readonly { lessons: number; plannedLessons?: number; skillId: string }[];
  itemSkillIds: ReadonlyMap<string, readonly string[]>;
  items: readonly BossPlanItem[];
  /** Requires plan order, with excluded areas removed. */
  skills: readonly { id: string }[];
  targetDate: Date | null;
};

type CoreLessons = ReadonlyMap<string, readonly BossPlanItem[]>;

const LEARN_KINDS = new Set<PlanItemKind>(["chapter", "lesson"]);

export function isBossTeachingItem(item: Pick<BossPlanItem, "kind" | "status">): boolean {
  return LEARN_KINDS.has(item.kind) && item.status !== "skipped" && item.status !== "testedOut";
}

/** Use scheduled days rather than completion dates so early finishes do not change the skills tested. */
function comesBy({ boss, item }: { boss: BossItem; item: BossPlanItem }): boolean {
  if (item.scheduledFor && boss.scheduledFor) {
    const order = item.scheduledFor.getTime() - boss.scheduledFor.getTime();
    return order < 0 || (order === 0 && item.position < boss.position);
  }

  return item.position < boss.position;
}

function listStudiedSkillIds({
  boss,
  phase,
  plan,
}: {
  boss: BossItem;
  phase?: number;
  plan: BossPlan;
}): string[] {
  const studied = new Set(
    plan.items
      .filter(
        (item) =>
          isBossTeachingItem(item) &&
          (phase === undefined || item.phase === phase) &&
          comesBy({ boss, item }),
      )
      .flatMap((item) => plan.itemSkillIds.get(item.id ?? item.key ?? "") ?? []),
  );

  return plan.skills.flatMap((skill) => (studied.has(skill.id) ? [skill.id] : []));
}

function firstWithSkills(lists: readonly (readonly string[])[]): string[] {
  return [...(lists.find((list) => list.length > 0) ?? lists.at(-1) ?? [])];
}

function pickBossSkillIds({
  asked,
  boss,
  core,
  plan,
}: {
  asked: ReadonlySet<string>;
  boss: BossItem;
  core: CoreLessons;
  plan: BossPlan;
}): string[] {
  const isFinished = (skillId: string) =>
    (core.get(skillId) ?? []).every((item) => comesBy({ boss, item }));

  const studied = listStudiedSkillIds({ boss, plan });
  const phase = listStudiedSkillIds({ boss, phase: boss.phase, plan });
  const ownPhase = new Set(phase);
  const finished = studied.filter((skillId) => isFinished(skillId));

  return firstWithSkills([
    finished.filter((skillId) => ownPhase.has(skillId)),
    finished.filter((skillId) => !asked.has(skillId)),
    finished,
    phase,
    studied,
  ]);
}

/** Challenges before the goal's date must ignore teaching scheduled after it when sizing each skill's core. */
export function getBossSkillIds({ boss, ...plan }: BossPlan & { boss: BossItem }): string[] {
  const { graphSkills, targetDate } = plan;
  const items = plan.items.toSorted((a, b) => a.position - b.position);
  const byDate = (date: Date | null) => targetDate !== null && date !== null && date <= targetDate;
  const core = listCoreLessonItems({ graphSkills, items });

  const coreByDate = listCoreLessonItems({
    graphSkills,
    items: items.filter((item) => !item.scheduledFor || byDate(item.scheduledFor)),
  });

  const coreFor = (checkpoint: BossItem) => (byDate(checkpoint.scheduledFor) ? coreByDate : core);

  const asked = plan.items
    .filter((item) => item.kind === "boss" && item.position < boss.position)
    .toSorted((a, b) => a.position - b.position)
    .reduce<ReadonlySet<string>>(
      (seen, earlier) =>
        seen.union(
          new Set(pickBossSkillIds({ asked: seen, boss: earlier, core: coreFor(earlier), plan })),
        ),
      new Set(),
    );

  return pickBossSkillIds({ asked, boss, core: coreFor(boss), plan });
}

/** Write questionsPerSkill for each skillId until it holds target; skip skills already at target. */
export type ChallengeQuestionWrite = {
  questionsPerSkill: number;
  skillIds: string[];
  target: number;
};

/** Input order breaks ties between equally short skills. */
export function planChallengeWrites(
  counts: readonly { questions: number; skillId: string }[],
): ChallengeQuestionWrite[] {
  const total = counts.reduce((sum, count) => sum + count.questions, 0);
  const written = new Map(counts.map((count) => [count.skillId, 0]));

  const held = (count: { questions: number; skillId: string }) =>
    count.questions + (written.get(count.skillId) ?? 0);

  for (let missing = CHECKPOINT_QUESTIONS - total; missing > 0 && counts.length > 0; missing -= 1) {
    const fewest = counts.reduce((low, count) => (held(count) < held(low) ? count : low));
    written.set(fewest.skillId, (written.get(fewest.skillId) ?? 0) + 1);
  }

  const writing = counts.filter((count) => (written.get(count.skillId) ?? 0) > 0);
  const groups = Map.groupBy(writing, (count) => written.get(count.skillId) ?? 0);

  return [...groups].map(([questionsPerSkill, group]) => ({
    questionsPerSkill,
    skillIds: group.map((count) => count.skillId),
    target: Math.max(...group.map((count) => held(count))),
  }));
}

export function getMissedSkills(
  answers: readonly { isCorrect: boolean; skillId: string | null }[],
): string[] {
  const misses = answers.flatMap((answer) =>
    !answer.isCorrect && answer.skillId ? [answer.skillId] : [],
  );

  return [...new Set(misses)]
    .map((skillId) => ({ count: misses.filter((miss) => miss === skillId).length, skillId }))
    .toSorted((a, b) => b.count - a.count)
    .map((entry) => entry.skillId);
}
