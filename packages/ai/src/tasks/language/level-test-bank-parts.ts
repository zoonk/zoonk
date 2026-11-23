import { combineTaskProvenance } from "../../provenance/combine-task-provenance";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { type GenerateLevelTestBankSchema } from "./level-test-bank";
import { LEVEL_TEST_SKILLS, type LevelTestSkill } from "./level-test-levels";

/** Twelve situations per skill cover a whole-course test. Short calls run side by side. */
const QUESTIONS_PER_SKILL = 12;
const QUESTIONS_PER_CALL = 4;

type QuestionBatch = { count: number; offset: number; skill: LevelTestSkill };
export type LevelTestBankPart = QuestionBatch | "confirmations";

export function getLevelTestQuestionBatches(
  questionsPerSkill = QUESTIONS_PER_SKILL,
): QuestionBatch[] {
  const total = Math.min(questionsPerSkill, QUESTIONS_PER_SKILL);

  return LEVEL_TEST_SKILLS.flatMap((skill) =>
    Array.from({ length: Math.ceil(total / QUESTIONS_PER_CALL) }, (_, index) => {
      const offset = index * QUESTIONS_PER_CALL;
      return { count: Math.min(total - offset, QUESTIONS_PER_CALL), offset, skill };
    }),
  );
}

export async function writeLevelTestBankParts(
  writePart: (
    part: LevelTestBankPart,
  ) => Promise<GenerateLevelTestBankSchema & { provenance: TaskProvenance }>,
) {
  const parts = await Promise.all(
    [...getLevelTestQuestionBatches(), "confirmations" as const].map((part) => writePart(part)),
  );

  return {
    confirmations: parts.flatMap((part) => part.confirmations),
    provenance: combineTaskProvenance(parts.map((part) => part.provenance)),
    questions: parts.flatMap((part) => part.questions),
  };
}
