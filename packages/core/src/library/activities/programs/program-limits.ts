export type ProgramKind = "javascript" | "python" | "sql";

/**
 * Enough for any lesson, short enough that an endless loop stops before the learner wonders.
 * The check before publishing uses the same limits as the player, so a reference program that
 * passes it also finishes in the learner's browser.
 */
export const PROGRAM_TIME_LIMIT_MS: Record<ProgramKind, number> = {
  javascript: 3000,
  python: 5000,
  sql: 3000,
};

/** Far more than a lesson prints; a loop printing forever hits it and stops. */
export const MAX_PROGRAM_OUTPUT_LENGTH = 10_000;

/** A tracer program is a few lines run a few times; this many steps means a runaway loop. */
export const MAX_TRACE_STEPS = 1000;
