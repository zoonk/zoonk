import { usageError } from "./errors.ts";
import { commandUsage } from "./help.ts";

function parseChoices(choices: string[] | undefined) {
  const groups = new Map<string, string[]>();

  for (const choice of choices ?? []) {
    const [group = "", option = ""] = choice.split("=", 2).map((part) => part.trim());

    if (!group || !option) {
      throw usageError(
        `Write --choice as "<group>=<option>": ${commandUsage("staff repair-exam-goal")}`,
      );
    }

    groups.set(group, [...(groups.get(group) ?? []), option]);
  }

  return groups.size > 0
    ? [...groups].map(([group, subjects]) => ({ group, subjects }))
    : undefined;
}

export function examGoalRepairCommand(
  [goalId]: string[],
  { apply, choice, country }: { apply?: boolean; choice?: string[]; country?: string },
) {
  const choices = parseChoices(choice);

  if (!country && !choices) {
    throw usageError(
      `Give --country or --choice from the learner's own words: ${commandUsage("staff repair-exam-goal")}`,
    );
  }

  return {
    name: "request",
    request: {
      body: { apply: apply === true, choices, country: country?.toUpperCase(), goalId },
      method: "POST",
      path: "/staff/exam-goal-repair",
    },
  } as const;
}
