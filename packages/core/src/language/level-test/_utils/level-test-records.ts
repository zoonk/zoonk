import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type LevelTestProgress, type LevelTestQuestion } from "../level-test-contract";

export type LevelTestAnswerRecord = {
  answer: LevelTestProgress["answers"][number];
  bankRunId: string;
  language: string;
  question: LevelTestQuestion;
  recordId: string;
  startScore: number;
  targetLanguage: string;
};

/** Callers save each answer once, under the learner's lock, so appending never repeats one. */
export async function recordLevelTestAnswer(
  tx: TransactionClient,
  record: LevelTestAnswerRecord,
): Promise<void> {
  const answers = JSON.stringify([record.answer]);
  const questions = JSON.stringify([record.question]);

  await tx.$executeRaw`
    INSERT INTO anonymous_level_tests
      (id, language, target_language, bank_run_id, start_score, answers, questions)
    VALUES (
      ${record.recordId}::uuid, ${record.language}, ${record.targetLanguage}, ${record.bankRunId},
      ${record.startScore}, ${answers}::jsonb, ${questions}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      answers = anonymous_level_tests.answers || EXCLUDED.answers,
      questions = anonymous_level_tests.questions || EXCLUDED.questions`;
}
