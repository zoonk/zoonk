/** A goal's date is its exam date or its end date; `unknown` where a card can't tell which. */
export type GoalDateKind = "exam" | "goal" | "unknown";

export function getGoalDateKind(goalKind: string | null | undefined): GoalDateKind {
  if (!goalKind) {
    return "unknown";
  }

  return goalKind === "exam" ? "exam" : "goal";
}
