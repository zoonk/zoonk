import { GatewayInvalidRequestError, type GatewayProviderSettings } from "@ai-sdk/gateway";
import { BLOCKED_TEST_CALL } from "@zoonk/utils/blocked-test-call";

/**
 * Tests can exercise real server routes or integration code, so missed mocks
 * must fail before a provider request leaves the process and spends credits.
 * The Gateway SDK retries unknown fetch failures as 500s, so this uses a
 * non-retryable Gateway error to make the test kill switch fail immediately.
 */
export const blockTestGatewayFetch: NonNullable<GatewayProviderSettings["fetch"]> = async () => {
  throw new GatewayInvalidRequestError({ message: BLOCKED_TEST_CALL });
};
