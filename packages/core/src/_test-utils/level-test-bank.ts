import {
  type CheckLevelTestQuestionsParams,
  type LevelTestQuestionCheck,
} from "@zoonk/ai/tasks/language/check-level-test-questions";
import { type generateLevelTestBankLevel } from "@zoonk/ai/tasks/language/level-test-bank";
import { type TestLevel } from "@zoonk/ai/tasks/language/level-test-levels";

type WrittenLevel = Awaited<ReturnType<typeof generateLevelTestBankLevel>>;

const NO_USAGE: WrittenLevel["usage"] = {
  inputTokenDetails: { cacheReadTokens: undefined, cacheWriteTokens: undefined, noCacheTokens: 0 },
  inputTokens: 0,
  outputTokenDetails: { reasoningTokens: undefined, textTokens: 0 },
  outputTokens: 0,
  totalTokens: 0,
};

function taskResult<Data>(data: Data) {
  return {
    data,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "anthropic/claude-fable-5.2",
      promptVersion: "test-prompt",
      provider: "anthropic",
      requestedModel: "anthropic/claude-fable-5.2",
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: NO_USAGE,
    userPrompt: "",
  };
}

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

function answerAsKeyed(
  question: CheckLevelTestQuestionsParams["questions"][number],
): LevelTestQuestionCheck {
  const answerIndex = "answerIndex" in question ? Number(question.answerIndex) : 0;
  return { leaks: [], literal: false, picks: [answerIndex], work: "Reaches the key." };
}

/** A check that passes every question, as it does for a writer that got them right. */
export async function checkLikeTheKeys({ questions }: CheckLevelTestQuestionsParams) {
  return taskResult({ checks: questions.map((question) => answerAsKeyed(question)) });
}
