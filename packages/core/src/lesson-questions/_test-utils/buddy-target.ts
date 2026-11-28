import { type TutorTarget } from "../contract";

/** One Buddy conversation per goal, so a test's questions share it: the goal's id doubles as its id. */
export function buddyTarget(goalId: string): Extract<TutorTarget, { kind: "plan" }> {
  return { conversationId: goalId, goalId, kind: "plan" };
}
