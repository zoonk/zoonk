/**
 * A generous per-step limit keeps client-supplied mistake counts well below
 * PostgreSQL's signed 32-bit progress counters, with room for daily aggregation.
 */
export const MAX_MATCH_COLUMNS_MISTAKES = 10_000;
