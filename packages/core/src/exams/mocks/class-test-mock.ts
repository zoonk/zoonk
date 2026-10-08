import { MIN_CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { type ExamStructure } from "../../library/exams/blueprint-contract";

/**
 * A class test read from the learner's own material (their teacher's slides) has no official
 * length, so its mocks copy a short test: ten questions in about half an hour, instead of the
 * long default meant for exams whose notice didn't say.
 */
const CLASS_TEST_QUESTIONS = 10;
const CLASS_TEST_MINUTES = 30;

/**
 * The short test's time on a day the learner gives less to (15 minutes on Thursday): the mock fits
 * the day, at the same pace, with never fewer questions than a checkpoint asks.
 */
function fitToDay(dayMinutes: number | null | undefined) {
  const minutes =
    dayMinutes && dayMinutes > 0 ? Math.min(CLASS_TEST_MINUTES, dayMinutes) : CLASS_TEST_MINUTES;

  return {
    minutes,
    questions: Math.max(
      MIN_CHECKPOINT_QUESTIONS,
      Math.round((CLASS_TEST_QUESTIONS * minutes) / CLASS_TEST_MINUTES),
    ),
  };
}

/**
 * The structure mocks copy: the blueprint's own, or a short test for a private blueprint (built
 * from the learner's material) that names no mock conditions, fitted to the time the learner gives
 * the mock's day (`dayMinutes`) when it's less than the short test takes.
 */
export function withClassTestMock({
  dayMinutes,
  ownerId,
  structure,
}: {
  dayMinutes?: number | null;
  ownerId: string | null;
  structure: ExamStructure;
}): ExamStructure {
  if (!ownerId || structure.mock) {
    return structure;
  }

  const fitted = fitToDay(dayMinutes);

  return {
    ...structure,
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "raw" },
      sections: [],
      timeLimitMinutes: fitted.minutes,
      totalQuestions: fitted.questions,
    },
  };
}
