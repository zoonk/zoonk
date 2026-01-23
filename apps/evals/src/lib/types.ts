import z from "zod";
import type { ReasoningEffort } from "@zoonk/ai/types";
import type { LanguageModelUsage } from "ai";

const MIN_SCORE = 6;

const stepSchema = z.object({
  conclusion: z.string(),
  kind: z.enum(["majorErrors", "minorErrors", "potentialImprovements"]),
  score: z.number().min(MIN_SCORE).max(10),
});

export const scoreSchema = z.object({
  steps: z.array(stepSchema),
});

export type Score = z.infer<typeof scoreSchema>;
export type ScoreStep = z.infer<typeof stepSchema>;

export type TestCase = {
  id: string;
  userInput: Record<string, unknown>;
  expectations: string;
};
export type TaskResult<T = unknown> = {
  data: T;
  usage: LanguageModelUsage;
  userPrompt: string;
  systemPrompt: string;
};

export type EvalResult = {
  testCase: TestCase;
  output: string;
  steps: Score["steps"];
  inputTokens: number;
  outputTokens: number;
  duration: number;
};

export type TaskEvalResults = {
  taskId: string;
  modelId: string;
  results: EvalResult[];
};

export type Task<TInput = unknown, TOutput = unknown> = {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  // Using method signature instead of property signature makes this bivariant,
  // allowing Task<SpecificInput> to be assignable to Task<unknown>
  generate(
    input: TInput & {
      model: string;
      useFallback?: boolean;
      reasoningEffort?: ReasoningEffort;
    },
  ): Promise<TaskResult<TOutput>>;
};

// === Output Types (Separated from Eval Results) ===

export type OutputEntry = {
  testCaseId: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  duration: number;
  systemPrompt: string;
  userPrompt: string;
};

export type ModelOutputs = {
  taskId: string;
  modelId: string;
  generatedAt: string;
  outputs: OutputEntry[];
};

// === Scored Result Types (Without output data) ===

export type ScoredResult = {
  testCase: TestCase;
  steps: Score["steps"];
};

export type ScoredTaskResults = {
  taskId: string;
  modelId: string;
  results: ScoredResult[];
};

// === Battle Mode Types ===

export type ModelRanking = {
  modelId: string;
  anonymousId: string;
  score: number;
  reasoning: string;
};

export type JudgeRanking = {
  judgeId: string;
  rankings: ModelRanking[];
};

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
  totalScore: number;
  averageScore: number;
  averageDuration: number;
  averageCost: number;
  scoresByJudge: Record<string, number>;
  scoresByTestCase: Record<string, number>;
};
