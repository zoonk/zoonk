export type ProgramKind = "javascript" | "python" | "sql";

export const PROGRAM_TIME_LIMIT_MS: Record<ProgramKind, number> = {
  javascript: 3000,
  python: 5000,
  sql: 3000,
};

export const MAX_PROGRAM_OUTPUT_LENGTH = 10_000;

export const MAX_TRACE_STEPS = 1000;
