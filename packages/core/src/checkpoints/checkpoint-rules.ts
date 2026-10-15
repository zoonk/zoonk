import { type PlanItemKind } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { listCoreLessonItems } from "../plans/_utils/core-lessons";

/**
 * Phase checkpoints (the Trickster boss): about ten mixed questions from the whole phase in the exam's
 * format, with no hints, favoring classic traps. Seven of ten wins. Losing costs nothing: up to two short
 * reinforcement lessons and a rematch the next day, and the next phase is never locked. A final
 * boss closes the plan. Weekly challenges use the same questions and pass mark rules.
 */
export const CHECKPOINT_QUESTIONS = 10;

/**
 * Fewer questions than this can't fairly judge a phase: a checkpoint short of them keeps its day
 * and gets its questions written when it starts (`getPlannedQuestions`).
 */
export const MIN_CHECKPOINT_QUESTIONS = 5;

/** Seven of ten: most of the phase, not perfection. Admin stats count passes with it too. */
export const PASS_SHARE = 0.7;

/** Maximum reinforcement before a rematch; distinct available lessons on the most-missed skills. */
export const REINFORCEMENT_LESSONS = 2;

/** A duel of ten questions takes about fifteen minutes, like any exam-format practice. */
export const CHECKPOINT_MINUTES_PER_QUESTION = 1.5;

export function getPassMark(questions: number): number {
  return Math.ceil(questions * PASS_SHARE);
}

/**
 * The questions a checkpoint is planned with: the ones the bank has for it, or its full ten while
 * the bank holds too few to judge it (they're written when it starts, so it asks ten then).
 */
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

/** Classic traps first (wrong options with a misconception), then questions never seen. */
function rankCandidate(candidate: CheckpointItemCandidate): number {
  const trapRank = candidate.hasMisconceptions ? 0 : 2;
  const seenRank = candidate.seen ? 1 : 0;

  return trapRank + seenRank;
}

/**
 * Picks a checkpoint's questions: mixed across the phase's skills, one skill after another in
 * turn, and within each skill the trap questions the learner hasn't seen first.
 */
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

/** What a plan item is to a phase's checkpoint: its kind, place and day, and what it teaches. */
type BossPlanItem = {
  id: string | null;
  key?: string;
  chapterId: string | null;
  kind: PlanItemKind;
  /** A Library lesson is one lesson; without one, a stand-in for `lessons` of them. */
  lessonId: string | null;
  lessons?: number | null;
  phase: number;
  position: number;
  scheduledFor: Date | null;
  skillId: string | null;
};

type BossItem = Pick<BossPlanItem, "phase" | "position" | "scheduledFor">;

type BossPlan = {
  /**
   * The plan graph's skills, with the lessons the plan's last build counted for each
   * (`plannedLessons`), which size its core; a plan saved before it counted them has the graph's
   * estimate (`lessons`).
   */
  graphSkills: readonly { lessons: number; plannedLessons?: number; skillId: string }[];
  /** Each plan item's skills, by its id. */
  itemSkillIds: ReadonlyMap<string, readonly string[]>;
  items: readonly BossPlanItem[];
  /** The plan's skills to ask, in plan order (without the areas the learner took out). */
  skills: readonly { id: string }[];
};

/** A skill's core lesson items (see `listCoreLessonItems`). */
type CoreLessons = ReadonlyMap<string, readonly BossPlanItem[]>;

const LEARN_KINDS = new Set<PlanItemKind>(["chapter", "lesson"]);

/**
 * Whether the plan has an item by a checkpoint: before its day, or on it before it in plan order
 * (a checkpoint that leads its day tests none of the lessons after it that day), by date when both
 * have one and by plan order otherwise. The plan's days, not what's done, so a plan always gives a
 * checkpoint the same skills, however far the learner got, and its checks read it the same way.
 */
function comesBy({ boss, item }: { boss: BossItem; item: BossPlanItem }): boolean {
  if (item.scheduledFor && boss.scheduledFor) {
    const order = item.scheduledFor.getTime() - boss.scheduledFor.getTime();
    return order < 0 || (order === 0 && item.position < boss.position);
  }

  return item.position < boss.position;
}

/** The skills of the learn items by a checkpoint's day, of its phase only with `phase`, in plan order. */
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
          LEARN_KINDS.has(item.kind) &&
          (phase === undefined || item.phase === phase) &&
          comesBy({ boss, item }),
      )
      .flatMap((item) => plan.itemSkillIds.get(item.id ?? item.key ?? "") ?? []),
  );

  return plan.skills.flatMap((skill) => (studied.has(skill.id) ? [skill.id] : []));
}

/** The first list with skills in it, else the last one. */
function firstWithSkills(lists: readonly (readonly string[])[]): string[] {
  return [...(lists.find((list) => list.length > 0) ?? lists.at(-1) ?? [])];
}

/**
 * What one checkpoint asks, after the ones before it asked `asked`: the skills whose core lessons
 * are all in by its day that none of them asked. With none, the finished skills its phase's
 * lessons study (a phase going on with skills it finished earlier), then every finished one (an
 * exam's window of practice and mocks, or a phase whose own skills begin late in it): a skill with
 * core lessons after its day is never asked while one is finished. Only when none is finished yet,
 * what it studied.
 */
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
  const finished = studied.filter((skillId) => isFinished(skillId));

  return firstWithSkills([
    finished.filter((skillId) => !asked.has(skillId)),
    phase.filter((skillId) => isFinished(skillId)),
    finished,
    phase,
    studied,
  ]);
}

/**
 * The skills a phase's checkpoint asks: the ones whose core lessons the plan has in by its day,
 * which no earlier checkpoint asked (`pickBossSkillIds`). A skill begun late in an exam's window,
 * its core in the next one, isn't asked before it's studied, and the next window's challenge asks
 * it (R40): each skill is asked once, by the first challenge after its core. The session's duel and
 * the questions written ahead for it ask the same.
 */
export function getBossSkillIds({ boss, ...plan }: BossPlan & { boss: BossItem }): string[] {
  const core = listCoreLessonItems({
    graphSkills: plan.graphSkills,
    items: plan.items
      .map((item) => ({ ...item, id: item.id ?? item.key ?? "" }))
      .toSorted((a, b) => a.position - b.position),
  });

  const asked = plan.items
    .filter((item) => item.kind === "boss" && item.position < boss.position)
    .toSorted((a, b) => a.position - b.position)
    .reduce<ReadonlySet<string>>(
      (seen, earlier) =>
        seen.union(new Set(pickBossSkillIds({ asked: seen, boss: earlier, core, plan }))),
      new Set(),
    );

  return pickBossSkillIds({ asked, boss, core, plan });
}

/**
 * Questions to write for a checkpoint short of its ten: `questionsPerSkill` more for each of
 * `skillIds`, which should then hold `target` (a skill holding as many by then is skipped).
 */
export type ChallengeQuestionWrite = {
  questionsPerSkill: number;
  skillIds: string[];
  target: number;
};

/**
 * What a checkpoint's skills lack of its ten questions, one question at a time to the skill with
 * the fewest (the earlier one on a tie), so its duel stays mixed across the phase and nothing
 * past its size is written. Skills that get as many new questions share one write.
 */
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

/** The skills a lost duel missed, the most missed first, for the reinforcement lessons. */
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
