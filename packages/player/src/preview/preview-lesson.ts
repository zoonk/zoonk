import { gradeStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/playable-lesson";
import { NOTHING_REACHED } from "@zoonk/core/sessions/reached";
import { type LessonPlayerAdapters, type LessonStartOutcome } from "../lesson/lesson-player-types";

function startedRun(): Extract<LessonStartOutcome, { reason: "started" }> {
  return {
    answers: [],
    hyperdrive: { knownStepIds: [], streak: 0 },
    reason: "started",
    runId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
  };
}

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

/** Written and spoken checks fail here; use a server adapter to grade them. */
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
          expected: graded.expected,
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
          ceremony: null,
          correctCount: 1,
          energyDelta: 1,
          incorrectCount: 0,
          isFirstCompletion: true,
          nextReviewAt: null,
          reached: NOTHING_REACHED,
          seconds: 60,
          studyBlock: null,
          totalBrainPower: 10,
        },
        status: "completed" as const,
      }),
    startLesson: () => Promise.resolve(startedRun()),
  };
}
