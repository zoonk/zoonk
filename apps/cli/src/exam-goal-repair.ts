import { usageError } from "./errors.ts";
import { commandUsage } from "./help.ts";

function parseChoice(choice: string) {
  const [group = "", option = ""] = choice.split("=", 2).map((part) => part.trim());

  if (!group || !option) {
    throw usageError(
      `Write --choice as "<group>=<option>": ${commandUsage("staff repair-exam-goal")}`,
    );
  }

  return { group, subjects: [option] };
}

export function examGoalRepairCommand(
  [goalId]: string[],
  { apply, choice, country }: { apply?: boolean; choice?: string; country?: string },
) {
  if ((choice === undefined) === (country === undefined)) {
    throw usageError(
      `Give either --country or --choice, from the learner's own words: ${commandUsage("staff repair-exam-goal")}`,
    );
  }

  const answer = choice ? { choice: parseChoice(choice) } : { country: country?.toUpperCase() };

  return {
    name: "request",
    request: {
      body: { apply: apply === true, goalId, ...answer },
      method: "POST",
      path: "/staff/exam-goal-repair",
    },
  } as const;
}
