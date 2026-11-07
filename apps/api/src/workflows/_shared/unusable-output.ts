const UNUSABLE = new Set(["AI_NoObjectGeneratedError", "UnusableOutputError"]);

/** A model answered with output its schema accepts but code can't use, such as nothing to keep. */
export class UnusableOutputError extends Error {
  override name = "UnusableOutputError";
}

/**
 * A model call answered every retry without output its schema accepts, such as when the model
 * refuses its input, or without output code can use (`UnusableOutputError`): a failure no retry
 * fixes, which the caller records or skips so later runs don't pay for it again. The AI tasks fail
 * an answer the provider cut off as an ordinary error instead (`failUnfinishedAnswer`). A step that
 * used up its retries fails with the runtime's error, whose `cause` is the step's own error without
 * its class, so the error is told by its name.
 */
export function isUnusableOutput(error: unknown): boolean {
  return error instanceof Error && (UNUSABLE.has(error.name) || isUnusableOutput(error.cause));
}
