import { GatewayInvalidRequestError, type GatewayProviderSettings } from "@ai-sdk/gateway";
import { BLOCKED_TEST_CALL } from "@zoonk/utils/blocked-test-call";

/** The Gateway SDK retries unknown fetch failures as 500s, so this throws a non-retryable error. */
export const blockTestGatewayFetch: NonNullable<GatewayProviderSettings["fetch"]> = async () => {
  throw new GatewayInvalidRequestError({ message: BLOCKED_TEST_CALL });
};
