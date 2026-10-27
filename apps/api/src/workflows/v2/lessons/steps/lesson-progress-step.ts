import { progressStep } from "@/workflows/_shared/stream-status";
import { type LessonContentStepName } from "@zoonk/core/library/generation/steps";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type LessonStreamStep = LessonContentStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of a lesson's run to its stream. */
export const lessonProgressStep = progressStep<LessonStreamStep>;
