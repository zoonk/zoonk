import { type GoalKind } from "@zoonk/db";

/**
 * The goals research starts for when they're created: an exam needs its official notice, and a
 * learn goal may depend on facts that change (a law, a product's docs) or be checked against
 * reference syllabi; research itself decides when nothing needs looking up. A language goal never
 * does (an exam in a language moves to an exam goal), and a quick explanation answers on its own.
 * Every way to start a goal (the API's routes, the web app's onboarding) follows it.
 */
export function isResearchedGoalKind(kind: GoalKind): boolean {
  return kind === "exam" || kind === "learn";
}
