import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type APIRequestContext, request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createAuthenticatedApiContext } from "./helpers/auth";

const SESSION_TRACE_FILE = "e2e/.auth/session-lookups.log";
const SESSION_TRACE_HEADER = "x-e2e-session-trace";

/**
 * Calls the real current-user resource with a correlation header that the E2E
 * Better Auth configuration records each time its get-session endpoint runs.
 */
async function getCurrentUserWithSessionTrace({
  apiContext,
  traceId,
}: {
  apiContext: APIRequestContext;
  traceId: string;
}) {
  return apiContext.get("/v1/me", { headers: { [SESSION_TRACE_HEADER]: traceId } });
}

/**
 * Counts only the calling test's trace identifier so parallel Playwright
 * workers can safely share the same append-only server trace.
 */
async function expectOneSessionLookup(traceId: string) {
  const trace = await readFile(SESSION_TRACE_FILE, "utf8");
  const matchingLookups = trace.split("\n").filter((entry) => entry === traceId);

  expect(matchingLookups).toHaveLength(1);
}

test.describe("Session request deduplication", () => {
  const baseURL = process.env.E2E_BASE_URL ?? "";

  test("deduplicates parallel session reads for cookie authentication", async () => {
    const traceId = randomUUID();

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "session-dedupe-cookie",
    });

    const response = await getCurrentUserWithSessionTrace({ apiContext, traceId });

    expect(response.status()).toBe(200);
    await expectOneSessionLookup(traceId);
    await apiContext.dispose();
  });

  test("deduplicates parallel session reads for bearer authentication", async () => {
    const traceId = randomUUID();

    const authContext = await createAuthenticatedApiContext({
      baseURL,
      prefix: "session-dedupe-bearer",
    });

    const bearerContext = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${authContext.token}` },
    });

    const response = await getCurrentUserWithSessionTrace({ apiContext: bearerContext, traceId });

    expect(response.status()).toBe(200);
    await expectOneSessionLookup(traceId);
    await Promise.all([authContext.apiContext.dispose(), bearerContext.dispose()]);
  });
});
