import { progressStep } from "@/workflows/_shared/stream-status";
import { type GoalContentStepName } from "@zoonk/core/library/generation/steps";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type GoalStreamStep = GoalContentStepName | typeof WORKFLOW_ERROR_STEP;

export const goalProgressStep = progressStep<GoalStreamStep>;
