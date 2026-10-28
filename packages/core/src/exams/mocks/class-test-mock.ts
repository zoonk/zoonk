import { MIN_CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { type ExamStructure } from "../../library/exams/blueprint-contract";

const CLASS_TEST_QUESTIONS = 10;
const CLASS_TEST_MINUTES = 30;

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
