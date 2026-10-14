type StepStatus = "started" | "completed" | "error";

/** Why a run stopped, sent with the `workflowError` step. */
type WorkflowErrorReason = "aiGenerationFailed" | "contentValidationFailed" | "notFound";

/**
 * The SSE message shape sent from the API and consumed by the UI.
 * This is the contract between the workflow streaming layer and the client.
 */
export type StepStreamMessage<TStep extends string = string> = {
  /**
   * When the step reported it, in milliseconds since the epoch on the server's clock, so a wait can
   * say how long each phase took even when the stream replays it later. Runs started before it was
   * sent don't carry it.
   */
  at?: number;
  entityId?: string;
  reason?: WorkflowErrorReason;
  status: StepStatus;
  step: TStep;
};

export const WORKFLOW_ERROR_STEP = "workflowError" as const;
