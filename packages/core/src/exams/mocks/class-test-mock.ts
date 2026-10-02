import { type ExamStructure } from "../../library/exams/blueprint-contract";

/**
 * A class test read from the learner's own material (their teacher's slides) has no official
 * length, so its mocks copy a short test: ten questions in about half an hour, instead of the
 * long default meant for exams whose notice didn't say.
 */
const CLASS_TEST_QUESTIONS = 10;
const CLASS_TEST_MINUTES = 30;

/**
 * The structure mocks copy: the blueprint's own, or a short test for a private blueprint (built
 * from the learner's material) that names no mock conditions.
 */
export function withClassTestMock({
  ownerId,
  structure,
}: {
  ownerId: string | null;
  structure: ExamStructure;
}): ExamStructure {
  if (!ownerId || structure.mock) {
    return structure;
  }

  return {
    ...structure,
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "raw" },
      sections: [],
      timeLimitMinutes: CLASS_TEST_MINUTES,
      totalQuestions: CLASS_TEST_QUESTIONS,
    },
  };
}
