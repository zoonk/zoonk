/**
 * A model call answered every retry without output its schema accepts, such as when the model
 * refuses its input: a failure no retry fixes, which the caller records so later runs skip it. A
 * step that used up its retries fails with the runtime's error, whose `cause` is the step's own
 * error without its class, so the AI SDK's error is told by its name.
 */
export function isUnusableOutput(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AI_NoObjectGeneratedError" || isUnusableOutput(error.cause))
  );
}
