import { type Reasoning } from "@zoonk/ai/provider-options";
import z from "zod";

const MIN_SCORE = 6;

const stepSchema = z.object({
  conclusion: z.string(),
  kind: z.enum(["majorErrors", "minorErrors", "potentialImprovements"]),
  score: z.number().min(MIN_SCORE).max(10),
});

export const scoreSchema = z.object({ steps: z.array(stepSchema) });

export const judgeCategoryScoreSchema = z.object({
  categoryId: z.string(),
  reasoning: z.string(),
  score: z.number().min(1).max(10),
});

export const categorizedScoreSchema = scoreSchema.extend({
  categoryScores: z.array(judgeCategoryScoreSchema),
});

type Score = z.infer<typeof scoreSchema>;
export type ScoreStep = z.infer<typeof stepSchema>;
export type JudgeCategoryScore = z.infer<typeof judgeCategoryScoreSchema>;

export type ScoreCategory = { id: string; label: string; weight: number; expectations: string };

export type CategoryScore = JudgeCategoryScore & { label: string; weight: number };

export type CategoryScoreSummary = Omit<CategoryScore, "reasoning">;

export type TestCase<TExpected = unknown, TInput = Record<string, unknown>> = {
  id: string;
  userInput: TInput;
  expectations?: string;
  expected?: TExpected;
  language?: string;
  origin?: "production";
};

export type LatencyBudget = { p50: number; p95: number };

export function getJudgeExpectations(testCase: TestCase): string {
  if (!testCase.expectations) {
    throw new Error(`Test case ${testCase.id} requires expectations for judge-based scoring.`);
  }

  return testCase.expectations;
}

export function supportsJudgeMode(task: Pick<RegisteredTask, "score" | "testCases">): boolean {
  return (
    !task.score &&
    task.testCases.length > 0 &&
    task.testCases.every((testCase) => Boolean(testCase.expectations))
  );
}

type TaskUsage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  inputTokenDetails?: { cacheReadTokens: number | undefined; cacheWriteTokens: number | undefined };
  outputTokenDetails?: { reasoningTokens: number | undefined };
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
};

export function toTokenUsage(usage: TaskUsage): TokenUsage {
  return {
    cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens,
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
  };
}

type TaskResult<T = unknown> = {
  data: T;
  usage: TaskUsage;
  extraCalls?: ModelCall[];
  userPrompt: string;
  systemPrompt: string;
  probabilities?: Record<string, number>;
};

export type ClassificationOutcome = { expected: string; predicted: string | null };

export type ModelCall = { modelId: string; usage: TokenUsage };

export type JudgeRun = ModelCall;

export type TaskScoreResult = {
  score: number;
  steps: Score["steps"];
  categoryScores?: CategoryScore[];
  classification?: ClassificationOutcome;
  judge?: JudgeRun;
};

type TaskScoreParams<TExpected = unknown> = { output: string; testCase: TestCase<TExpected> };

export type TaskScorer<TExpected = unknown> = (
  params: TaskScoreParams<TExpected>,
) => Promise<TaskScoreResult> | TaskScoreResult;

type TaskGenerateInput<TInput> = TInput & {
  model: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

export type EvalResult = TokenUsage & {
  testCase: TestCase;
  output: string;
  extraCalls?: ModelCall[];
  steps: Score["steps"];
  categoryScores?: CategoryScore[];
  classification?: ClassificationOutcome;
  judge?: JudgeRun;
  duration: number;
};

export type TaskEvalResults = { taskId: string; modelId: string; results: EvalResult[] };

/** Execute registry tasks only with their paired test case; the default input type intentionally forbids arbitrary input. */
export type Task<TInput = never, TOutput = unknown, TExpected = unknown> = {
  id: string;
  name: string;
  description: string;
  testCases: TestCase<TExpected, TInput>[];
  generate: (input: TaskGenerateInput<TInput>) => Promise<TaskResult<TOutput>>;
  evaluate?: (input: TaskGenerateInput<TInput>) => Promise<TaskResult<TOutput>>;
  score?: TaskScorer<TExpected>;
  scoreCategories?: ScoreCategory[];
  latencyBudget?: LatencyBudget;
  output?: "image" | "speech" | "transcription";
};

/** Only invoke generate or score with the test case paired with this type-erased task. */
export type RegisteredTask = Omit<Task<never, unknown, never>, "score" | "testCases"> & {
  testCases: TestCase[];
  score?: (params: never) => Promise<TaskScoreResult> | TaskScoreResult;
};

export type OutputEntry = TokenUsage & {
  testCaseId: string;
  output: string;
  extraCalls?: ModelCall[];
  duration: number;
  systemPrompt: string;
  userPrompt: string;
  probabilities?: Record<string, number>;
};

export type ModelOutputs = {
  taskId: string;
  modelId: string;
  generatedAt: string;
  outputs: OutputEntry[];
};

export type TestCaseOutput = OutputEntry & { testCase: TestCase };

export type TaskModelOutputResults = {
  taskId: string;
  modelId: string;
  generatedAt: string;
  outputs: TestCaseOutput[];
};

export type ScoredResult = {
  testCase: TestCase;
  steps: Score["steps"];
  categoryScores?: CategoryScore[];
  classification?: ClassificationOutcome;
  judge?: JudgeRun;
};

export type ScoredTaskResults = { taskId: string; modelId: string; results: ScoredResult[] };

export type ModelRanking = {
  modelId: string;
  anonymousId: string;
  score: number;
  reasoning: string;
  categoryScores?: CategoryScore[];
};

type JudgeRanking = { judgeId: string; rankings: ModelRanking[]; usage?: TokenUsage };

export type BattleMatchup = {
  taskId: string;
  testCaseId: string;
  expectations: string;
  judgedAt: string;
  judgments: JudgeRanking[];
};

export type BattleLeaderboardEntry = {
  modelId: string;
  modelName: string;
  provider: string;
  averageScore: number;
  latencyP50: number;
  latencyP95: number;
  costPer1000Runs: number;
  scoresByJudge: Record<string, number>;
  scoresByTestCase: Record<string, number>;
  categoryScores: CategoryScoreSummary[];
};
