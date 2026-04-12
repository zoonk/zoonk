import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type InvestigationLoopState } from "./completion-input-schema";

type ActionStepResult = {
  answer: object;
  answeredAt: Date;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
  isCorrect: boolean;
  stepId: bigint;
};

/**
 * Builds one StepAttempt entry per experiment from the investigation
 * loop state and the action step's content.
 *
 * Each experiment gets its own StepAttempt with isCorrect based on
 * the action's quality tier: critical/useful = correct, weak = incorrect.
 * All 3 share the same stepId (the physical action step).
 *
 * Returns an empty array when the investigation loop is missing or
 * the action step doesn't exist.
 */
export function buildInvestigationActionResults({
  investigationLoop,
  steps,
}: {
  investigationLoop: InvestigationLoopState | undefined;
  steps: { id: bigint; kind: string; content: unknown }[];
}): ActionStepResult[] {
  if (!investigationLoop) {
    return [];
  }

  const actionStep = steps.find((step) => {
    if (step.kind !== "investigation") {
      return false;
    }

    const content = parseStepContent("investigation", step.content);
    return content.variant === "action";
  });

  if (!actionStep) {
    return [];
  }

  const actionContent = parseStepContent("investigation", actionStep.content);

  if (actionContent.variant !== "action") {
    return [];
  }

  return investigationLoop.usedActionIds.flatMap((actionId, i) => {
    const action = actionContent.actions.find((a) => a.id === actionId);
    const timing = investigationLoop.actionTimings[i];

    if (!action || !timing) {
      return [];
    }

    return [
      {
        answer: {
          kind: "investigation" as const,
          selectedActionId: actionId,
          variant: "action" as const,
        },
        answeredAt: new Date(timing.answeredAt),
        dayOfWeek: timing.dayOfWeek,
        durationSeconds: timing.durationSeconds,
        hourOfDay: timing.hourOfDay,
        isCorrect: action.quality !== "weak",
        stepId: actionStep.id,
      },
    ];
  });
}
