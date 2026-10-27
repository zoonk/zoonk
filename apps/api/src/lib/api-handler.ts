import { isInputRangeError } from "@zoonk/core/plans/target-date-range";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { errors } from "./api-errors";
import { targetDateOutOfRange } from "./plan-errors";
import { InvalidRequestError } from "./request-input";

type ProductRouteHandler<TArguments extends unknown[]> = (
  ...args: TArguments
) => Promise<Response> | Response;

/** A GET: what it asks for comes in its query, as a parameter like any other. */
function isQuery(args: unknown[]): boolean {
  const [request] = args;
  return request instanceof Request && request.method === "GET";
}

/**
 * Keeps unexpected product API failures on the same JSON error contract as
 * explicit validation and authorization failures. Better Auth and documentation
 * routes remain outside this boundary because they own their response formats.
 * Next.js control-flow errors must escape unchanged so rendering, redirects, and
 * Cache Components can coordinate request execution internally.
 */
export function withApiErrorBoundary<TArguments extends unknown[]>(
  handler: ProductRouteHandler<TArguments>,
) {
  return async (...args: TArguments): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      unstable_rethrow(error);

      if (error instanceof InvalidRequestError) {
        return errors.validation(error.zodError);
      }

      // A target date out of range is the request's to fix: a query's like any other parameter,
      // a change's with its own code. Every other error, a ZodError included, is the server's.
      if (isInputRangeError(error)) {
        return isQuery(args) ? errors.validation(error) : targetDateOutOfRange(error);
      }

      logError("[Public API Error]", error);
      return errors.internal();
    }
  };
}
