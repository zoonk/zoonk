import type { LanguageModelUsage } from "ai";
import z from "zod";

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
    input: TInput & { model: string; useFallback?: boolean },
  ): Promise<TaskResult<TOutput>>;
};
