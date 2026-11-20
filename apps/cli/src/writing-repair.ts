import { usageError } from "./errors.ts";
import { commandUsage } from "./help.ts";

export function writingRepairCommand(
  [phase]: string[],
  { after, apply }: { after?: string; apply?: boolean },
) {
  if (phase !== "blueprints" && phase !== "learners") {
    throw usageError(`Choose "blueprints" or "learners": ${commandUsage("staff repair-writing")}`);
  }

  return {
    name: "request",
    request: {
      body: { after, apply: apply === true, phase },
      method: "POST",
      path: "/staff/writing-repair",
    },
  } as const;
}
