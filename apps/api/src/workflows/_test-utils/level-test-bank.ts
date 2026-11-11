import { type CheckLevelTestQuestionsParams } from "@zoonk/ai/tasks/language/check-level-test-questions";
import { type generateLevelTestBankLevel } from "@zoonk/ai/tasks/language/level-test-bank";
import { type TestLevel } from "@zoonk/ai/tasks/language/level-test-levels";
import { taskResult } from "./recorded-outputs";

type WrittenLevel = Awaited<ReturnType<typeof generateLevelTestBankLevel>>;

/** Two reading and two listening questions keyed on their first option, all on "<passage> <level>". */
export function writtenLevel({
  level,
  passage,
}: {
  level: TestLevel;
  passage: string;
}): WrittenLevel {
  return taskResult({
    questions: (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map(() => ({
        answerIndex: 0,
        level,
        options: ["a", "b", "c", "d"],
        passage: `${passage} ${level}`,
        question: "O que diz?",
        skill,
      })),
    ),
    speaking: { level, sentence: `Say ${level}`, translation: "Diga" },
  });
}

/** A check that passes every question, as it does for a writer that got them right. */
export async function checkLikeTheKeys({ questions }: CheckLevelTestQuestionsParams) {
  return taskResult({
    checks: questions.map((question) => ({
      leaks: [],
      literal: false,
      picks: ["answerIndex" in question ? Number(question.answerIndex) : 0],
      work: "Reaches the key.",
    })),
  });
}
