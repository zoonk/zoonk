import { getWritable } from "workflow";

export type StepStatus = "started" | "completed" | "error";

export type WorkflowErrorReason =
  | "aiEmptyResult"
  | "aiGenerationFailed"
  | "contentValidationFailed"
  | "dbFetchFailed"
  | "dbSaveFailed"
  | "enrichmentFailed"
  | "noSourceData"
  | "notFound";

export function getAIResultErrorReason(
  error: Error | null | undefined,
  result: unknown,
): WorkflowErrorReason {
  if (error) {
    return "aiGenerationFailed";
  }
  if (!result) {
    return "aiEmptyResult";
  }
  return "contentValidationFailed";
}

export async function streamStatus<T extends string>(params: {
  reason?: WorkflowErrorReason;
  step: T;
  status: StepStatus;
}) {
  "use step";

  const writable = getWritable<string>();
  const writer = writable.getWriter();

  try {
    const message = params;
    await writer.write(`data: ${JSON.stringify(message)}\n\n`);
  } finally {
    writer.releaseLock();
  }
}
