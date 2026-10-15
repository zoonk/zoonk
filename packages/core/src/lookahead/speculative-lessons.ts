import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  DEFAULT_START_POSITION,
  type OwnLevel,
  START_POSITIONS,
} from "../learner/placement/placement-steps";
import { planGoalForPick } from "../plans/refresh-goal-plan";
import { isPlacementAhead } from "../view-models/onboarding/onboarding-steps";

type PlannedLesson = { lessonId: string; phase: number };

/** A lesson the plan has to do, in plan order: `null` for a stand-in, whose lessons aren't outlined. */
type PlanLesson = { lessonId: string | null; phase: number };

/**
 * The plan's lessons not done yet, in plan order, from the plan worked out from what it plans
 * from now (see `planGoalForPick`): lessons the Library outlined since the plan was saved take
 * their stand-ins' places whatever run outlined them, and what placement settled is out, even
 * while the run saving them still waits its turn. A plan that stays as saved (not built yet, or
 * holding lessons for the learner's OK) is read as saved; a paused goal has none to write.
 */
async function loadPlanLessons(goalId: string): Promise<PlanLesson[]> {
  const { plan, status } = await planGoalForPick(goalId);

  if (status === "notFound" || status === "paused") {
    return [];
  }

  if (plan) {
    return plan.built.items.flatMap((item) =>
      item.kind === "lesson" && item.status === "todo"
        ? [{ lessonId: item.lessonId, phase: item.phase }]
        : [],
    );
  }

  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true, phase: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });
}

/**
 * The plan's lessons that may be written ahead now, in plan order. A wrong guess costs little
 * when the lesson is shared: the next learner reads it. A lesson only this learner reads (a course
 * from their own material) waits while placement is still ahead, since placement may test it out
 * and nobody would ever open it. A lesson set aside is never written.
 */
async function toWritableLessons({
  goalId,
  lessons,
}: {
  goalId: string;
  lessons: readonly PlanLesson[];
}) {
  const [goal, stored] = await Promise.all([
    prisma.goal.findUnique({ select: { details: true }, where: { id: goalId } }),
    prisma.lesson.findMany({
      select: { contentStatus: true, id: true, visibility: true },
      where: {
        id: { in: lessons.flatMap((lesson) => (lesson.lessonId ? [lesson.lessonId] : [])) },
        setAsideAt: null,
      },
    }),
  ]);

  const placementAhead = isPlacementAhead(isJsonObject(goal?.details) ? goal.details : {});
  const byId = new Map(stored.map((lesson) => [lesson.id, lesson]));

  return lessons.flatMap(({ lessonId, phase }) => {
    const lesson = lessonId ? byId.get(lessonId) : undefined;

    return lessonId && lesson && !(placementAhead && lesson.visibility === "private")
      ? [{ lessonId, phase, status: lesson.contentStatus }]
      : [];
  });
}

/**
 * The phases a learner most likely starts in while placement is still running: the first one
 * (placement often finds gaps early) and the one where their own level points in the plan. A
 * learner starting from nothing skips placement and surely starts at the beginning, so the first
 * phase is the only guess; one with no level given guesses the phase right after it too.
 */
function pickLikelyStartPhases({
  lessons,
  ownLevel,
}: {
  lessons: readonly PlannedLesson[];
  ownLevel: OwnLevel | null;
}): number[] {
  const phases = [...new Set(lessons.map((lesson) => lesson.phase))];
  const [first] = phases;

  if (first === undefined) {
    return [];
  }

  if (ownLevel === "none") {
    return [first];
  }

  const position = ownLevel ? START_POSITIONS[ownLevel] : DEFAULT_START_POSITION;
  const pointed = lessons[Math.round(position * (lessons.length - 1))]?.phase ?? first;
  const second = pointed === first ? phases[1] : pointed;

  return second === undefined ? [first] : [first, second];
}

/**
 * The first lessons of the likeliest starting phases that aren't written yet, for speculative
 * generation during onboarding: `count` in all (more for Plus subscribers, `getLookahead`), split
 * between the guesses, one list per guess in plan order. The first lesson of each list is where the learner starts if that guess is right.
 * A wrong guess costs little: the lessons go into the shared Library for the next learner. The
 * learner's own lessons wait for placement (see `toWritableLessons`). Picks from the plan worked
 * out from what it plans from now (see `loadPlanLessons`).
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function pickSpeculativeLessons({
  count,
  goalId,
  ownLevel,
}: {
  count: number;
  goalId: string;
  ownLevel: OwnLevel | null;
}): Promise<string[][]> {
  const lessons = await toWritableLessons({ goalId, lessons: await loadPlanLessons(goalId) });
  const phases = pickLikelyStartPhases({ lessons, ownLevel });
  const perPhase = Math.ceil(count / Math.max(phases.length, 1));

  // Lessons already written (found in the Library) need nothing: the next ones are guessed instead.
  const guesses = phases.map((phase) =>
    lessons
      .filter((lesson) => lesson.phase === phase && lesson.status !== "completed")
      .slice(0, perPhase)
      .map((lesson) => lesson.lessonId),
  );

  return guesses.filter((guess) => guess.length > 0);
}

/**
 * The plan's first lesson, to write the moment the plan starts there while placement moves the
 * start: null while it can wait (the learner's own lesson, with placement still ahead, which may
 * test it out; see `toWritableLessons`), or when the plan has no lesson to write first, in the plan
 * worked out from what it plans from now (see `loadPlanLessons`).
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function pickPlanStartToWrite(goalId: string): Promise<string | null> {
  const lessons = await loadPlanLessons(goalId);
  const [first] = lessons;
  const writable = await toWritableLessons({ goalId, lessons });

  return writable.some((lesson) => lesson.lessonId === first?.lessonId)
    ? (first?.lessonId ?? null)
    : null;
}

/**
 * The lessons of `lessonIds` still to write for the goal, right before their writing starts: the
 * ones the plan, worked out again from what it plans from now (see `loadPlanLessons`), still has
 * the learner do. One the learner finished, placement tested out, an area they skipped, or a draft
 * held back took out since it was picked doesn't start, so no model call writes a lesson the plan no
 * longer has them do; one the plan worked out has before its save lands still does.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function admitPlanLessons({
  goalId,
  lessonIds,
}: {
  goalId: string;
  lessonIds: readonly string[];
}): Promise<string[]> {
  const lessons = await loadPlanLessons(goalId);
  const planned = new Set(lessons.map((lesson) => lesson.lessonId));

  return lessonIds.filter((lessonId) => planned.has(lessonId));
}
