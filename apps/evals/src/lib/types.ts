import type { LanguageModelUsage } from "ai";
import z from "zod";

const MIN_SCORE = 6;

const stepSchema = z.object({
  kind: z.enum(["major_errors", "minor_errors", "potential_improvements"]),
  conclusion: z.string(),
  score: z.number().min(MIN_SCORE).max(10),
});

export const scoreSchema = z.object({
  steps: z.array(stepSchema),
});

export type Score = z.infer<typeof scoreSchema>;
export type ScoreStep = z.infer<typeof stepSchema>;

export interface TestCase {
  id: string;
  userInput: Record<string, string>;
  expectations: string;
}
export interface TaskResult<T = unknown> {
  data: T;
  usage: LanguageModelUsage;
  userPrompt: string;
  systemPrompt: string;
}

export interface EvalResult {
  testCase: TestCase;
  output: string;
  steps: Score["steps"];
  inputTokens: number;
  outputTokens: number;
  duration: number;
}

export interface TaskEvalResults {
  taskId: string;
  modelId: string;
  results: EvalResult[];
}

export interface Task<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  // Using method signature instead of property signature makes this bivariant,
  // allowing Task<SpecificInput> to be assignable to Task<unknown>
  generate(input: TInput & { model: string }): Promise<TaskResult<TOutput>>;
}
