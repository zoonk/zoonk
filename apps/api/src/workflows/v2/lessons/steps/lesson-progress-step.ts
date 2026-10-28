import { progressStep } from "@/workflows/_shared/stream-status";
import { type LessonContentStepName } from "@zoonk/core/library/generation/steps";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type LessonStreamStep = LessonContentStepName | typeof WORKFLOW_ERROR_STEP;

export const lessonProgressStep = progressStep<LessonStreamStep>;
