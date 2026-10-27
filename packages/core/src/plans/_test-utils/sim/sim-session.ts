import { createHash } from "node:crypto";
import {
  CHECKPOINT_MINUTES_PER_QUESTION,
  getBossSkillIds,
  getPlannedQuestions,
} from "../../../checkpoints/checkpoint-rules";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../../language/conversations/conversation-rules";
import { listKnownSkillIds } from "../../../learner/placement/placement-known";
import { getLessonLookahead, pickDayLessons } from "../../../sessions/_utils/day-lessons";
import { getGoalDayMinutes } from "../../../sessions/_utils/day-minutes";
import { markLessonsAroundChallenges } from "../../../sessions/_utils/lessons-before-challenges";
import { getSkippedSkillIds } from "../../../sessions/_utils/review-skills";
import { MIN_BLOCK_MINUTES } from "../../../sessions/session-builder";
import { daysBetween, toIsoDate } from "../../planner/plan-calendar";
import { DEFAULT_LESSON_MINUTES } from "../../planner/plan-units";
import { LEARN_KINDS, type SimPlan, type SimSession, type SimWorld, getSimGoal } from "./sim-world";

/** A free exam plan's new lessons stop after its first days (`getExamPrepAccess`). */
const FREE_EXAM_STUDY_DAYS = 7;

export function shortHash(text: string): number {
  return createHash("sha1").update(text).digest().readUInt32BE(0);
}

/** No new lessons on a review day, and a free plan's mock day is its full review. */
function isReviewDay(world: SimWorld): boolean {
  const day = toIsoDate(world.today);

  return world.plan.items.some(
    (item) =>
      item.scheduledFor !== null &&
      toIsoDate(item.scheduledFor) === day &&
      (item.kind === "review" || (item.kind === "mock" && !world.learner.subscribed)),
  );
}

/**
 * The minutes a duel takes from the day (`buildCheckpointBlock`): a language unit's call, or a
 * challenge planned at its full ten questions, which a bank without them writes when it starts.
 */
function getBossMinutes(world: Pick<SimWorld, "inputs">): number {
  return world.inputs.goal.kind === "language"
    ? CHECKPOINT_CALL_BLOCK_MINUTES
    : getPlannedQuestions(0) * CHECKPOINT_MINUTES_PER_QUESTION;
}

/** A free exam plan's first days are over: no new lessons or duels (`getExamPrepAccess`). */
function isTrialEnded({ start, world }: { start: Date; world: SimWorld }): boolean {
  return (
    world.inputs.goal.kind === "exam" &&
    !world.learner.subscribed &&
    daysBetween(start, world.today) >= FREE_EXAM_STUDY_DAYS
  );
}

function getDayMinutes(world: SimWorld): number {
  return getGoalDayMinutes({
    date: world.today,
    goal: getSimGoal(world),
    planSettings: world.plan.state.settings,
  });
}

/**
 * The duels today's session holds (`buildSessionBlocks`): the bosses it reached
 * (`findSessionBosses`), but none on a day without time for a block or once a free exam plan's
 * first days are over.
 */
export function findSessionDuels({ start, world }: { start: Date; world: SimWorld }) {
  return isTrialEnded({ start, world }) || getDayMinutes(world) < MIN_BLOCK_MINUTES
    ? []
    : findSessionBosses(world);
}

/** Each lesson's minutes, the default for one without an estimate (as `loadPlanLessons` gives it). */
function listLessonMinutes(world: SimWorld): Map<string, number> {
  const { inputs } = world;

  return new Map(
    [...inputs.lessons, ...inputs.quickLessons.values()].map((lesson) => [
      lesson.lessonId,
      lesson.minutes || DEFAULT_LESSON_MINUTES,
    ]),
  );
}

/**
 * The lessons a session build takes (`buildSessionBlocks`): the plan's next ones
 * (`pickDayLessons`, as many as the day looks ahead) the day doesn't hold yet, while they fit
 * `budget`, and on a challenge's first duel only those the plan has before the day's last one or
 * after it by today (`markLessonsAroundChallenges`). None on a review day or once a free exam
 * plan's first days are over. The library has no questions, so no reviews or practice take time
 * from lessons.
 */
function takeSessionLessons({
  bosses,
  budget,
  firstDuel,
  held = [],
  start,
  world,
}: {
  /** The day's challenges. */
  bosses: readonly SimPlan["items"][number][];
  budget: number;
  firstDuel: boolean;
  held?: readonly string[];
  start: Date;
  world: SimWorld;
}): string[] {
  const { inputs, plan, today } = world;

  if (isReviewDay(world) || isTrialEnded({ start, world })) {
    return [];
  }

  const heldIds = new Set(held);

  const { learnItems } = pickDayLessons({
    awaitingOutlines: false,
    goal: inputs.goal,
    localDate: today,
    plan: {
      graph: plan.state.graph,
      // Without recordings, practice asks a listening skill nothing (`loadIdleListeningSkillIds`).
      idleSkillIds: inputs.listeningSkillIds,
      items: plan.items,
      prerequisites: inputs.prerequisites,
    },
  });

  // The day's challenges as the session duels them, its lessons marked around them.
  const marked = markLessonsAroundChallenges({
    checkpoints: bosses.map((boss) => ({ kind: "boss", planItemId: boss.id, rematch: false })),
    items: plan.items,
    lessons: learnItems
      .slice(0, getLessonLookahead(getDayMinutes(world)))
      .map((item) => ({ ...item, planItemId: item.id })),
    today,
  });

  const lessons = marked
    .filter((item) => !firstDuel || item.beforeChallenge || item.afterChallenge)
    .flatMap((item) => (item.lessonId && !heldIds.has(item.lessonId) ? [item.lessonId] : []));

  const minutes = listLessonMinutes(world);

  const total = (count: number) =>
    lessons
      .slice(0, count)
      .reduce((sum, id) => sum + (minutes.get(id) ?? DEFAULT_LESSON_MINUTES), 0);

  const fitting = lessons.filter((_, index) => total(index + 1) <= budget);
  const [first] = lessons;

  return fitting.length === 0 && first && budget >= MIN_BLOCK_MINUTES ? [first] : fitting;
}

/**
 * Today's session as `buildSessionBlocks` builds it from the plan: the challenges it reached
 * (`findSessionDuels`) and the lessons that fit what they leave of the day's minutes. A day without
 * time for a block has none.
 */
export function buildSimSession({ start, world }: { start: Date; world: SimWorld }): SimSession {
  const dayMinutes = getDayMinutes(world);
  const bosses = findSessionDuels({ start, world });

  const lessons =
    dayMinutes < MIN_BLOCK_MINUTES
      ? []
      : takeSessionLessons({
          bosses,
          budget: dayMinutes - bosses.length * getBossMinutes(world),
          firstDuel: bosses.length > 0,
          start,
          world,
        });

  return { duels: bosses.map((boss) => boss.id), lessons, version: world.plan.version };
}

/**
 * Today's session read again after the plan changed without the learner (lessons landing, a
 * re-plan): what it holds stays, and new lessons join its end, up to the day's time
 * (`refreshDayFromPlan`). Its challenges and lessons take their minutes first; a challenge it
 * doesn't hold yet takes its own too, but only lessons join. A day built without anything is built
 * again.
 */
export function followSimPlan({
  session,
  start,
  world,
}: {
  session: SimSession;
  start: Date;
  world: SimWorld;
}): SimSession {
  if (world.plan.version <= session.version) {
    return session;
  }

  if (session.lessons.length === 0 && session.duels.length === 0) {
    return buildSimSession({ start, world });
  }

  const minutes = listLessonMinutes(world);
  const bossMinutes = getBossMinutes(world);
  const bosses = findSessionDuels({ start, world });
  const held = new Set(session.duels);
  const added = bosses.filter((boss) => !held.has(boss.id));

  const used =
    session.lessons.reduce((sum, id) => sum + (minutes.get(id) ?? DEFAULT_LESSON_MINUTES), 0) +
    session.duels.length * bossMinutes;

  const left = getDayMinutes(world) - used;

  const lessons =
    left < MIN_BLOCK_MINUTES
      ? []
      : takeSessionLessons({
          bosses,
          budget: left - added.length * bossMinutes,
          firstDuel: added.length > 0,
          held: session.lessons,
          start,
          world,
        });

  return { ...session, lessons: [...session.lessons, ...lessons], version: world.plan.version };
}

/**
 * The skills a plan item teaches, as the learner's goal plan reads them (`loadGoalPlan`): its own
 * skill, or the skills its lesson teaches.
 */
function listItemSkills(
  item: SimPlan["items"][number],
  taughtBy: SimWorld["inputs"]["taughtBy"],
): readonly string[] {
  if (item.skillId) {
    return [item.skillId];
  }

  return item.lessonId ? (taughtBy.get(item.lessonId) ?? []) : [];
}

/**
 * Whether a boss's questions can be written when it starts (`loadBoss`): a language goal's is a
 * call, and another goal's needs a skill text questions can ask. A phase heard only through
 * recordings has none without its listening sets, which the fixtures don't have.
 */
function isBossWritable({
  boss,
  world,
}: {
  boss: SimPlan["items"][number];
  world: Pick<SimWorld, "inputs" | "learner" | "plan">;
}): boolean {
  const { inputs, plan } = world;

  if (inputs.goal.kind === "language") {
    return true;
  }

  const skipped = getSkippedSkillIds({ graph: plan.state.graph, settings: plan.state.settings });

  const entries = plan.items.flatMap((item) =>
    listItemSkills(item, inputs.taughtBy).map((id) => ({ id, phase: item.phase })),
  );

  // The plan's skills in plan order, each in the phase of its first item.
  const skills = entries.filter(
    (entry, index) =>
      !skipped.has(entry.id) && entries.findIndex((other) => other.id === entry.id) === index,
  );

  const itemSkillIds = new Map(
    plan.items.map((item) => [item.id, listItemSkills(item, inputs.taughtBy)]),
  );

  const graphSkills = plan.state.graph.skills;

  return getBossSkillIds({
    boss,
    graphSkills,
    itemSkillIds,
    items: plan.items,
    skills,
    targetDate: getSimGoal(world).targetDate,
  }).some((skillId) => !inputs.listeningSkillIds.has(skillId));
}

/**
 * The bosses today's session duels (`loadSessionBosses`), whose first duel holds new lessons back
 * that day: a language goal's unit calls, and other goals' challenges, whose questions are written
 * when they start. None when the first can't be written; a later one that can't is left out.
 */
function findSessionBosses(world: Pick<SimWorld, "inputs" | "learner" | "plan" | "today">) {
  const [first, ...later] = findBosses(world.plan.items, world.today);

  if (!first || !isBossWritable({ boss: first, world })) {
    return [];
  }

  return [first, ...later.filter((boss) => isBossWritable({ boss, world }))];
}

/**
 * The first boss the learner reached, then any later phase's whose day came too, earlier phase
 * first (`findSessionBosses` in boss-reached.ts).
 */
function findBosses(items: SimPlan["items"], today: Date) {
  const first = findReachedBoss(items, today);

  if (!first) {
    return [];
  }

  const later = items.filter(
    (boss) =>
      boss.kind === "boss" &&
      boss.status === "todo" &&
      boss.phase > first.phase &&
      boss.scheduledFor !== null &&
      boss.scheduledFor <= today,
  );

  return [first, ...later.toSorted((a, b) => a.phase - b.phase)];
}

/**
 * The phase's boss the learner reached (`isBossReached`): every lesson before it in its phase is
 * done, or its day came (the only way for a phase with no lessons of its own).
 */
function findReachedBoss(items: SimPlan["items"], today: Date) {
  const isReached = (boss: SimPlan["items"][number]) => {
    const lessons = items.filter(
      (other) =>
        other.position < boss.position && other.phase === boss.phase && LEARN_KINDS.has(other.kind),
    );

    return (
      (boss.scheduledFor !== null && boss.scheduledFor <= today) ||
      (lessons.length > 0 && lessons.every((other) => other.status !== "todo"))
    );
  };

  return items.find((boss) => boss.kind === "boss" && boss.status === "todo" && isReached(boss));
}

/** The skills a plan holds stand-ins for (due by `until`), in its order: the Library outlines them next. */
export function listStandInSkills({
  items,
  until,
}: {
  items: SimPlan["items"];
  until: Date;
}): string[] {
  const waiting = items.flatMap((item) =>
    item.status === "todo" &&
    item.kind === "lesson" &&
    !item.lessonId &&
    !item.chapterId &&
    item.skillId &&
    item.scheduledFor !== null &&
    item.scheduledFor <= until
      ? [item.skillId]
      : [],
  );

  return [...new Set(waiting)];
}

/**
 * Placement as its real rule reads the answers: what it takes as known (only what a skill's own
 * answers confirm, see `listKnownSkillIds`), and what it missed. Its questions come in the exam's
 * choice format (`loadPlacementItems`), where one right statement says less.
 */
export function place({
  answers,
  format,
  world,
}: {
  answers: readonly (readonly [string, boolean])[];
  format: "multipleChoice" | "trueFalse";
  world: Pick<SimWorld, "plan">;
}): { known: string[]; missed: string[] } {
  const evidence = answers.map(([skillId, correct]) => ({
    format,
    outcome: correct ? ("correct" as const) : ("wrong" as const),
    skillId,
  }));

  const known = listKnownSkillIds({
    answers: evidence,
    evidence,
    focusedSkillIds: new Set(),
    skillIds: world.plan.state.graph.skills.map((skill) => skill.skillId),
  });

  return {
    known,
    missed: evidence.flatMap((entry) => (entry.outcome === "correct" ? [] : [entry.skillId])),
  };
}
