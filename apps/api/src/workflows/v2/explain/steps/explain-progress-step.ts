import { progressStep } from "@/workflows/_shared/stream-status";
import { type ExplanationStepName } from "@zoonk/core/library/generation/steps";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type ExplanationStreamStep = ExplanationStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of an explain run to its stream. */
export const explainProgressStep = progressStep<ExplanationStreamStep>;
