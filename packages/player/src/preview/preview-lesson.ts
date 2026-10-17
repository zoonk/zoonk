import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/contract";
import { gradeStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type LessonPlayerAdapters, type LessonStartOutcome } from "../lesson/lesson-player-types";

/** A new run, started the moment the screen opens. */
function startedRun(): Extract<LessonStartOutcome, { reason: "started" }> {
  return {
    answers: [],
    hyperdrive: { knownStepIds: [], streak: 0 },
    reason: "started",
    runId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
  };
}

/** A lesson of the given screens, in the order given. */
export function buildLesson(
  steps: PlayableLibraryLesson["steps"],
  overrides: Partial<PlayableLibraryLesson> = {},
): PlayableLibraryLesson {
  return {
    canDo: null,
    chapter: null,
    description: "A lesson of the player's preview screens",
    estimatedMinutes: 5,
    id: crypto.randomUUID(),
    language: "en",
    level: "beginner",
    skills: [],
    steps: steps.map((step, position) => ({ ...step, position })),
    summaryIdeas: [],
    targetLanguage: null,
    title: "Preview lesson",
    ...overrides,
  };
}

/**
 * Adapters that answer like the server without one: the run starts, each answer is graded the way
 * the server grades it (with the same function the device uses), and the lesson completes. Written
 * and spoken answers are graded only on the server, so their checks fail here.
 */
export function localAdapters(lesson: PlayableLibraryLesson): LessonPlayerAdapters {
  return {
    checkStep: ({ answer, stepId }) => {
      const step = lesson.steps.find((item) => item.id === stepId);
      const graded = step ? gradeStepAnswer({ answer, language: lesson.language, step }) : null;

      if (!graded) {
        return Promise.resolve({ status: "failed" as const });
      }

      return Promise.resolve({
        result: {
          checked: true,
          correctAnswer: graded.correctAnswer,
          corrections: [],
          feedback: graded.feedback,
          isCorrect: graded.isCorrect,
          keyPoints: null,
          nextReviewAt: null,
          savedMistake: !graded.isCorrect,
          score: null,
          spelling: null,
        },
        status: "checked" as const,
      });
    },
    completeLesson: () =>
      Promise.resolve({
        completion: {
          brainPower: 10,
          correctCount: 1,
          energyDelta: 1,
          incorrectCount: 0,
          isFirstCompletion: true,
          nextReviewAt: null,
          seconds: 60,
          studyBlock: null,
          totalBrainPower: 10,
        },
        status: "completed" as const,
      }),
    startLesson: () => Promise.resolve(startedRun()),
  };
}
