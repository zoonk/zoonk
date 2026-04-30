/**
 * Rejection tests often need the actual thrown value so they can inspect
 * properties that are not exposed by `rejects.toThrow`. Returning the rejected
 * value keeps test assertions outside catch callbacks, so the assertion always
 * runs after the promise rejects.
 */
async function getRejectedError(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("Expected promise to reject.");
    },
    (error: unknown) => error,
  );
}

/**
 * Workflow steps can fail more than one save at once and report those failures
 * through `AggregateError.errors`. This helper makes that contract explicit and
 * fails with a clear message if the step resolves or throws another error type.
 */
export async function getRejectedAggregateError(
  promise: Promise<unknown>,
): Promise<AggregateError> {
  const error = await getRejectedError(promise);
  if (error instanceof AggregateError) {
    return error;
  }

  throw new Error("Expected promise to reject with AggregateError.");
}
