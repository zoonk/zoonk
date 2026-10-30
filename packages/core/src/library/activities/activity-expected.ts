import { type ActivityExpected } from "./activity-expected-answer";
import {
  type ActivityStepContent,
  type ExploreActivityContent,
  exploresSolved,
  getActivityTemplate,
} from "./activity-templates";

export function getActivityExpected(content: ActivityStepContent): ActivityExpected | null {
  const { check } = content;

  if (check.kind === "choice") {
    const correct = check.options.find((option) => option.isCorrect);
    return correct ? { kind: "choice", optionId: correct.id } : null;
  }

  if (check.kind === "numeric") {
    return { kind: "numeric", value: check.answer };
  }

  const answer = getActivityTemplate(content.template)?.computeExpected(content.fields) ?? null;

  return answer ? { answer, kind: "interaction" } : null;
}

/** An explanation's explore shows its solved end state when its template checks only that end state. */
export function getExploreExpected(explore: ExploreActivityContent): ActivityExpected | null {
  if (!exploresSolved(explore.template)) {
    return null;
  }

  return getActivityExpected({
    ...explore,
    check: { explanation: "", kind: "interaction" },
    prompt: "",
  });
}
