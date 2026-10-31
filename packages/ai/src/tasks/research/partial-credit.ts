import { z } from "zod";

/**
 * `perRightPick`: each right pick earns its share while no wrong one is picked. `perOption`: each
 * right pick earns a fixed part and any wrong pick is a wrong answer (JEE Advanced's). `plusMinus`:
 * +1 per right pick, -1 per wrong one, never below zero. Core's mock scoring applies them.
 */
export const PARTIAL_CREDIT_RULES = [
  "allOrNothing",
  "perRightPick",
  "perOption",
  "plusMinus",
] as const;

export const partialCreditSchema = z.enum(PARTIAL_CREDIT_RULES);

export type PartialCreditRule = z.infer<typeof partialCreditSchema>;
