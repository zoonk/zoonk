import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  DEFAULT_START_POSITION,
  type OwnLevel,
  START_POSITIONS,
} from "../learner/placement/placement-steps";
import { isPlacementAhead } from "../view-models/onboarding/onboarding-steps";

type PlannedLesson = { lessonId: string; phase: number };

/**
 * The plan's lessons not done yet that may be written ahead now, in plan order. A wrong guess
 * costs little when the lesson is shared: the next learner reads it. A lesson only this learner
 * reads (a course from their own material) waits while placement is still ahead, since placement
 * may test it out and nobody would ever open it.
 */
async function loadWritableLessons(goalId: string) {
  const [goal, items] = await Promise.all([
    prisma.goal.findUnique({ select: { details: true }, where: { id: goalId } }),
    prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: {
        lesson: { select: { contentStatus: true, visibility: true } },
        lessonId: true,
        phase: true,
      },
      where: {
        kind: "lesson",
        lesson: { setAsideAt: null },
        lessonId: { not: null },
        plan: { goalId },
        status: "todo",
      },
    }),
  ]);

  const placementAhead = isPlacementAhead(isJsonObject(goal?.details) ? goal.details : {});

  return items.flatMap((item) =>
    item.lessonId && !(placementAhead && item.lesson?.visibility === "private")
      ? [{ lessonId: item.lessonId, phase: item.phase, status: item.lesson?.contentStatus }]
      : [],
  );
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
 * learner's own lessons wait for placement (see `loadWritableLessons`).
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
  const lessons = await loadWritableLessons(goalId);
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
 * test it out; see `loadWritableLessons`), or when the plan has no lesson to write first.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function pickPlanStartToWrite(goalId: string): Promise<string | null> {
  const [first, writable] = await Promise.all([
    prisma.planItem.findFirst({
      orderBy: { position: "asc" },
      select: { lessonId: true },
      where: { kind: "lesson", plan: { goalId }, status: "todo" },
    }),
    loadWritableLessons(goalId),
  ]);

  return writable.some((lesson) => lesson.lessonId === first?.lessonId)
    ? (first?.lessonId ?? null)
    : null;
}
