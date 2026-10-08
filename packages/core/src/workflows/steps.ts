type StepStatus = "started" | "completed" | "error";

/** Why a run stopped, sent with the `workflowError` step. */
type WorkflowErrorReason = "aiGenerationFailed" | "contentValidationFailed" | "notFound";

/**
 * The SSE message shape sent from the API and consumed by the UI.
 * This is the contract between the workflow streaming layer and the client.
 */
export type StepStreamMessage<TStep extends string = string> = {
  entityId?: string;
  reason?: WorkflowErrorReason;
  status: StepStatus;
  step: TStep;
};

export const WORKFLOW_ERROR_STEP = "workflowError" as const;
