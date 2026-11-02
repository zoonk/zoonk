type StepStatus = "started" | "completed" | "error";

type WorkflowErrorReason = "aiGenerationFailed" | "contentValidationFailed" | "notFound";

export type StepStreamMessage<TStep extends string = string> = {
  /** Server epoch milliseconds at report time, not replay time; absent on older runs. */
  at?: number;
  entityId?: string;
  reason?: WorkflowErrorReason;
  status: StepStatus;
  step: TStep;
};

export const WORKFLOW_ERROR_STEP = "workflowError" as const;
