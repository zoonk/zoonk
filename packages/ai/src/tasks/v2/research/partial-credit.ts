import { z } from "zod";

/**
 * How an exam scores a multiple-choice question that asks for several options, as its notice
 * states it: `allOrNothing` (only every right option and nothing else earns it), `perRightPick`
 * (each right option picked earns its share of the right ones while no wrong one is picked),
 * `perOption` (each right option picked earns a fixed part of the marks, all of them the full
 * marks, and any wrong pick is a wrong answer: JEE Advanced's +1 per option, +4 for all, -2), or
 * `plusMinus` (+1 per right pick and -1 per wrong one, never below zero). Mock scoring holds the
 * table that applies them (`@zoonk/core` exams scoring).
 */
export const PARTIAL_CREDIT_RULES = [
  "allOrNothing",
  "perRightPick",
  "perOption",
  "plusMinus",
] as const;

export const partialCreditSchema = z.enum(PARTIAL_CREDIT_RULES);

export type PartialCreditRule = z.infer<typeof partialCreditSchema>;
