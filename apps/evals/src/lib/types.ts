import { type ReasoningEffort } from "@zoonk/ai/provider-options";
import { type LanguageModelUsage } from "ai";
import z from "zod";

const MIN_SCORE = 6;

const stepSchema = z.object({
  conclusion: z.string(),
  kind: z.enum(["majorErrors", "minorErrors", "potentialImprovements"]),
  score: z.number().min(MIN_SCORE).max(10),
});

export const scoreSchema = z.object({ steps: z.array(stepSchema) });

type Score = z.infer<typeof scoreSchema>;
export type ScoreStep = z.infer<typeof stepSchema>;

export type TestCase = { id: string; userInput: Record<string, unknown>; expectations: string };
type TaskResult<T = unknown> = {
  data: T;
  usage: LanguageModelUsage;
  userPrompt: string;
  systemPrompt: string;
};

export type TaskGenerateInput<TInput> = TInput & {
  model: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export type EvalResult = {
  testCase: TestCase;
  output: string;
  steps: Score["steps"];
  inputTokens: number;
  outputTokens: number;
  duration: number;
};

export type TaskEvalResults = { taskId: string; modelId: string; results: EvalResult[] };

/**
 * The default input is never because the task registry stores many tasks with
 * different input shapes. A registry task is safe to inspect, but execution
 * must happen through the paired test case data for that concrete task.
 */
export type Task<TInput = never, TOutput = unknown> = {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  generate: (input: TaskGenerateInput<TInput>) => Promise<TaskResult<TOutput>>;
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

export type TestCaseOutput = OutputEntry & { testCase: TestCase };

export type TaskModelOutputResults = {
  taskId: string;
  modelId: string;
  generatedAt: string;
  outputs: TestCaseOutput[];
};

// === Scored Result Types (Without output data) ===

export type ScoredResult = { testCase: TestCase; steps: Score["steps"] };

export type ScoredTaskResults = { taskId: string; modelId: string; results: ScoredResult[] };

// === Battle Mode Types ===

export type ModelRanking = {
  modelId: string;
  anonymousId: string;
  score: number;
  reasoning: string;
};

type JudgeRanking = { judgeId: string; rankings: ModelRanking[] };

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
