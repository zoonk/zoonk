import { type GatewayProviderSettings, createGateway } from "@ai-sdk/gateway";

const isTest =
  process.env.E2E_TESTING === "true" ||
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true";

/**
 * Tests can exercise real server routes or integration code, so missed mocks
 * must fail before a provider request leaves the process and spends credits.
 */
const blockTestGatewayFetch: NonNullable<GatewayProviderSettings["fetch"]> = async () => {
  throw new Error("AI Gateway calls are disabled during tests.");
};

export const zoonkGateway = createGateway({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestGatewayFetch : undefined,
  headers: {
    "http-referer": "https://www.zoonk.com",
    "x-title": "Zoonk",
  },
});
