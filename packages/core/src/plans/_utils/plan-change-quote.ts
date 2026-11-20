import { createHash } from "node:crypto";
import { type PlanChangeQuote } from "../plan-decision-contract";
import { type PlanEffect } from "../planner/plan-effect";

const QUOTE_LENGTH = 22;

/**
 * A proposal's numbers can change while its plan version and study day stay the same (a refresh
 * that keeps the plan's lessons reprices it), so the quote is read from the numbers themselves.
 */
export function getPlanChangeQuote(effect: PlanEffect | null): PlanChangeQuote {
  return createHash("sha256")
    .update(JSON.stringify(effect))
    .digest("base64url")
    .slice(0, QUOTE_LENGTH);
}
