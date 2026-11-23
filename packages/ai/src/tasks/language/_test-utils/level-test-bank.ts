import {
  type CheckLevelTestQuestionsParams,
  type LevelTestQuestionCheck,
} from "../check-level-test-questions";
import { type generateLevelTestBankPart } from "../level-test-bank";
import { type LevelTestBankPart } from "../level-test-bank-parts";
import { type TestLevel } from "../level-test-levels";

type WrittenLevel = Awaited<ReturnType<typeof generateLevelTestBankPart>>;

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

/** @internal Shared by core and workflow tests. Two questions per skill are keyed on their first option. */
export function writtenLevel({
  level,
  passage,
}: {
  level: TestLevel;
  passage: string;
}): WrittenLevel {
  return taskResult({
    confirmations: (["reading", "listening"] as const).map((skill) => ({
      answerIndices: [0, 1],
      level,
      options: ["a", "b", "c", "d", "e"],
      passage: `${passage} ${level}`,
      question: "O que é verdade?",
      skill,
    })),
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
  });
}

/** @internal Shared by core and workflow tests. */
export function writtenPart({
  level,
  part,
  passage,
}: {
  level: TestLevel;
  part: LevelTestBankPart;
  passage: string;
}): WrittenLevel {
  const result = writtenLevel({ level, passage });

  return {
    ...result,
    data: {
      confirmations: part === "confirmations" ? result.data.confirmations : [],
      questions:
        part === "confirmations"
          ? []
          : result.data.questions
              .filter(({ skill }) => skill === part.skill)
              .slice(part.offset, part.offset + part.count),
    },
  };
}

function answerAsKeyed(
  question: CheckLevelTestQuestionsParams["questions"][number],
): LevelTestQuestionCheck {
  const answerIndex = "answerIndex" in question ? Number(question.answerIndex) : 0;
  return { leaks: [], literal: false, picks: [answerIndex], work: "Reaches the key." };
}

/** @internal Shared by core and workflow tests. Passes every question as keyed. */
export async function checkLikeTheKeys({ questions }: CheckLevelTestQuestionsParams) {
  return taskResult({ checks: questions.map((question) => answerAsKeyed(question)) });
}
