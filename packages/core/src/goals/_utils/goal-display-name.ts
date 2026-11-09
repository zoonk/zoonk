import { type GoalKind } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

export function defaultDisplayName(goal: {
  details?: unknown;
  kind: GoalKind;
  language: string;
  title: string;
}): string {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const examName = typeof details.examName === "string" ? details.examName.trim() : "";

  if (goal.kind === "exam" && examName) {
    return examName;
  }

  const subject = typeof details.subject === "string" ? details.subject.trim() : "";

  if ((goal.kind === "language" || goal.kind === "learn") && subject) {
    const [first] = new Intl.Segmenter(goal.language, { granularity: "grapheme" }).segment(subject);
    const grapheme = first?.segment ?? "";

    return grapheme.toLocaleUpperCase(goal.language) + subject.slice(grapheme.length);
  }

  return goal.title;
}

export function resolveGoalDisplayName(goal: {
  displayName: string | null;
  title: string;
}): string {
  return goal.displayName ?? goal.title;
}
