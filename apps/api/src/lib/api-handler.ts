import { isPlanConflictError } from "@zoonk/core/plans/conflict";
import { isInputRangeError } from "@zoonk/core/plans/target-date-range";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { errors } from "./api-errors";
import { planChangedWhileSaving, targetDateOutOfRange } from "./plan-errors";
import { InvalidRequestError } from "./request-input";

type ProductRouteHandler<TArguments extends unknown[]> = (
  ...args: TArguments
) => Promise<Response> | Response;

function isQuery(args: unknown[]): boolean {
  const [request] = args;
  return request instanceof Request && request.method === "GET";
}

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

      // A query's out-of-range date is a validation error like any parameter; a change's gets its
      // own code.
      if (isInputRangeError(error)) {
        return isQuery(args) ? errors.validation(error) : targetDateOutOfRange(error);
      }

      if (isPlanConflictError(error)) {
        return planChangedWhileSaving();
      }

      logError("[Public API Error]", error);
      return errors.internal();
    }
  };
}
