import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";

/** Fits the 10-character language column with its `x` prefix. */
const PAIR_SUFFIX_LENGTH = 8;

/**
 * Two reading and two listening questions per level, ids like `reading-B1-0`, each keyed on its
 * first option.
 */
export function levelTestQuestions<Level extends string>(levels: readonly Level[]) {
  return levels.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 0,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["a", "b", "c", "d"],
        passage: `${skill} ${level}`,
        question: "What does it say?",
        skill,
      })),
    ),
  );
}

/** A stored placement bank of `levelTestQuestions` for a pair no other test uses. */
export async function levelTestBankFixture({ levels }: { levels: readonly string[] }) {
  const pair = { language: `x${randomUUID().slice(0, PAIR_SUFFIX_LENGTH)}`, targetLanguage: "ja" };
  const runId = randomUUID();
  const questions = levelTestQuestions(levels);

  await prisma.languageLevelTest.create({
    data: {
      ...pair,
      content: { questions, speaking: [] },
      model: "test",
      promptVersion: "test",
      runId,
    },
  });

  return { pair, questions, runId };
}

/** `count` kept level tests that each gave `picks`: question id to option, null for "I don't know". */
export async function recordedLevelTestsFixture({
  count,
  pair,
  picks,
  runId,
  startScore,
}: {
  count: number;
  pair: { language: string; targetLanguage: string };
  picks: Record<string, number | null>;
  runId: string;
  startScore: number;
}) {
  const answers = Object.entries(picks).map(([id, answerIndex]) => ({
    answerIndex,
    durationMs: 0,
    id,
  }));

  await prisma.anonymousLevelTest.createMany({
    data: Array.from({ length: count }, () => ({
      ...pair,
      answers,
      bankRunId: runId,
      id: randomUUID(),
      questions: [],
      startScore,
    })),
  });
}
