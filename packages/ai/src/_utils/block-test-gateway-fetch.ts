import { GatewayInvalidRequestError, type GatewayProviderSettings } from "@ai-sdk/gateway";

const BLOCKED_MESSAGE = "AI Gateway calls are disabled during tests.";

/**
 * Tests can exercise real server routes or integration code, so missed mocks
 * must fail before a provider request leaves the process and spends credits.
 * The Gateway SDK retries unknown fetch failures as 500s, so this uses a
 * non-retryable Gateway error to make the test kill switch fail immediately.
 */
export const blockTestGatewayFetch: NonNullable<GatewayProviderSettings["fetch"]> = async () => {
  throw new GatewayInvalidRequestError({ message: BLOCKED_MESSAGE });
};

/**
 * Whether the test kill switch stopped a call. Every model behind the gateway is stopped the same
 * way, so a fallback to another one would only fail again: the error is final.
 */
export function isBlockedTestCall(error: unknown): boolean {
  return GatewayInvalidRequestError.isInstance(error) && error.message === BLOCKED_MESSAGE;
}
