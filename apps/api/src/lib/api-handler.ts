import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { errors } from "./api-errors";

type ProductRouteHandler<TArguments extends unknown[]> = (
  ...args: TArguments
) => Promise<Response> | Response;

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
      logError("[Public API Error]", error);
      return errors.internal();
    }
  };
}
