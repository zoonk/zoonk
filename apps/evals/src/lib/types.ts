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
  /**
   * The case's language when the input doesn't carry one (`language` or
   * `learnerLanguage`) and the id doesn't start with it ("pt-..."), such as a
   * goal typed in Portuguese. Results are reported per language from it.
   */
  language?: string;
  /** Built from an anonymized `sample:production` row instead of written by hand. */
  origin?: "production";
};

/**
 * The slowest a task may be, in seconds, for the model to count as a fit.
 * Tight where learners wait on the answer, and absent for work made ahead of time.
 */
export type LatencyBudget = { p50: number; p95: number };

/**
 * Judge-based scoring needs a prose rubric, while deterministic scorers can
 * omit it and rely only on structured expected values. This keeps the runtime
 * requirement explicit at the boundary that invokes a judge.
 */
export function getJudgeExpectations(testCase: TestCase): string {
  if (!testCase.expectations) {
    throw new Error(`Test case ${testCase.id} requires expectations for judge-based scoring.`);
  }

  return testCase.expectations;
}

/**
 * Keeps judge mode exclusive to tasks that rely on model-based scoring. A custom
 * scorer is the source of truth for deterministic scoring, even when older test
 * cases still contain prose expectations that were originally written for a judge.
 */
export function supportsJudgeMode(task: Pick<RegisteredTask, "score" | "testCases">): boolean {
  return (
    !task.score &&
    task.testCases.length > 0 &&
    task.testCases.every((testCase) => Boolean(testCase.expectations))
  );
}

/**
 * Generation tasks return the AI SDK's full usage, while evaluation models only
 * report input and output totals. This shape accepts both so routing by model
 * kind does not need separate result types.
 */
type TaskUsage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  inputTokenDetails?: { cacheReadTokens: number | undefined; cacheWriteTokens: number | undefined };
  outputTokenDetails?: { reasoningTokens: number | undefined };
};

/** Normalized token counts persisted with every output and judgment. */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
};

/**
 * Keeps cache and reasoning counts only when the provider reported them, so
 * saved files from before this detail existed still price as plain input.
 */
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
  userPrompt: string;
  systemPrompt: string;
  /** Label probabilities from evaluation models, kept for threshold tuning. */
  probabilities?: Record<string, number>;
};

/**
 * What a classifier expected and produced for one case. Scorers that compare
 * labels return it so results can show per-label accuracy and a confusion
 * matrix instead of one average.
 */
export type ClassificationOutcome = { expected: string; predicted: string | null };

/** The model that scored an output and what that call used, so judge spend is visible. */
export type JudgeRun = { modelId: string; usage: TokenUsage };

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
  steps: Score["steps"];
  categoryScores?: CategoryScore[];
  classification?: ClassificationOutcome;
  judge?: JudgeRun;
  duration: number;
};

export type TaskEvalResults = { taskId: string; modelId: string; results: EvalResult[] };

/**
 * The default input is never because the task registry stores many tasks with
 * different input shapes. A registry task is safe to inspect, but execution
 * must happen through the paired test case data for that concrete task.
 */
export type Task<TInput = never, TOutput = unknown, TExpected = unknown> = {
  id: string;
  name: string;
  description: string;
  testCases: TestCase<TExpected, TInput>[];
  generate: (input: TaskGenerateInput<TInput>) => Promise<TaskResult<TOutput>>;
  /**
   * Answers the task with an evaluation model (Jev, or a language model through
   * the evaluation adapter) and returns the same output shape as `generate`,
   * so one scorer compares both kinds of model. Only classifiers define it.
   */
  evaluate?: (input: TaskGenerateInput<TInput>) => Promise<TaskResult<TOutput>>;
  score?: TaskScorer<TExpected>;
  scoreCategories?: ScoreCategory[];
  latencyBudget?: LatencyBudget;
  /**
   * Tasks that draw images, transcribe audio or talk over a realtime session run on those models
   * only, and text tasks never do.
   */
  output?: "image" | "realtime" | "transcription";
};

/**
 * The task registry stores many tasks with incompatible input and expected
 * shapes. Individual task files keep their concrete Task type, while registry
 * consumers use this erased shape and only call generate/score with the paired
 * test case that came from the same task entry.
 */
export type RegisteredTask = Omit<Task<never, unknown, never>, "score" | "testCases"> & {
  testCases: TestCase[];
  score?: (params: never) => Promise<TaskScoreResult> | TaskScoreResult;
};

// === Output Types (Separated from Eval Results) ===

export type OutputEntry = TokenUsage & {
  testCaseId: string;
  output: string;
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

// === Scored Result Types (Without output data) ===

export type ScoredResult = {
  testCase: TestCase;
  steps: Score["steps"];
  categoryScores?: CategoryScore[];
  classification?: ClassificationOutcome;
  judge?: JudgeRun;
};

export type ScoredTaskResults = { taskId: string; modelId: string; results: ScoredResult[] };

// === Battle Mode Types ===

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

/**
 * Judges never score their own model family, so contestants get different
 * numbers of judgments. Rankings use the average score, never a sum.
 */
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
