import type { LanguageModelUsage } from "ai";

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
  score: number;
  steps: Array<{
    kind: "major_errors" | "minor_errors" | "potential_improvements";
    conclusion: string;
    score: number;
  }>;
  inputTokens: number;
  outputTokens: number;
}

export interface TaskEvalResults {
  taskId: string;
  modelId: string;
  results: EvalResult[];
  averageScore: number;
  averageInputTokens: number;
  averageOutputTokens: number;
  totalCost: number;
}

export interface Task<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  generate: (input: TInput & { model: string }) => Promise<TaskResult<TOutput>>;
  formatOutput: (output: TOutput) => string;
}
