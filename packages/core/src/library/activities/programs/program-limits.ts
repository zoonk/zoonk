import { PROGRAM_LANGUAGES } from "./program-languages";

export type ProgramKind = "javascript" | "python" | "sql";

export const PROGRAM_TIME_LIMIT_MS: Record<ProgramKind, number> = {
  javascript: PROGRAM_LANGUAGES.javascript.timeLimitMs,
  python: PROGRAM_LANGUAGES.python.timeLimitMs,
  sql: 3000,
};

export const MAX_PROGRAM_OUTPUT_LENGTH = 10_000;

export const MAX_QUERY_ROWS = 200;

export function capProgramText(text: string): string {
  return text.slice(0, MAX_PROGRAM_OUTPUT_LENGTH);
}

export const MAX_TRACE_STEPS = 1000;
