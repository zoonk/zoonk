import "server-only";
import { prisma } from "@zoonk/db";
import {
  DEFAULT_START_POSITION,
  type OwnLevel,
  START_POSITIONS,
} from "../learner/placement/placement-steps";

/** A guess is cheap, but still capped: about a first day of lessons, split between the guesses. */
const SPECULATIVE_LESSONS = 4;

type PlannedLesson = { lessonId: string; phase: number };

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
 * generation during onboarding: four in all, split between the guesses, one list per guess in
 * plan order. The first lesson of each list is where the learner starts if that guess is right.
 * A wrong guess costs little: the lessons go into the shared Library for the next learner.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function pickSpeculativeLessons({
  goalId,
  ownLevel,
}: {
  goalId: string;
  ownLevel: OwnLevel | null;
}): Promise<string[][]> {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lesson: { select: { contentStatus: true } }, lessonId: true, phase: true },
    where: {
      kind: "lesson",
      lesson: { setAsideAt: null },
      lessonId: { not: null },
      plan: { goalId },
      status: "todo",
    },
  });

  const lessons = items.flatMap((item) =>
    item.lessonId
      ? [{ lessonId: item.lessonId, phase: item.phase, status: item.lesson?.contentStatus }]
      : [],
  );

  const phases = pickLikelyStartPhases({ lessons, ownLevel });
  const perPhase = Math.ceil(SPECULATIVE_LESSONS / Math.max(phases.length, 1));

  // Lessons already written (found in the Library) need nothing: the next ones are guessed instead.
  const guesses = phases.map((phase) =>
    lessons
      .filter((lesson) => lesson.phase === phase && lesson.status !== "completed")
      .slice(0, perPhase)
      .map((lesson) => lesson.lessonId),
  );

  return guesses.filter((guess) => guess.length > 0);
}
