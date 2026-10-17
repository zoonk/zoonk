import { randomUUID } from "node:crypto";
import { getNumber, getString } from "@zoonk/utils/json";

const CREATE_TIMEOUT_MS = 30_000;
const CLOSE_TIMEOUT_MS = 15_000;

export const TEST_LIVE_SDP_ANSWER = "v=0\r\ns=e2e-provider-peer\r\n";

/** E2E builds replace only the AI boundary; production never imports this module. */
function assertTestEnvironment() {
  if (process.env.E2E_TESTING !== "true") {
    throw new Error("The Live test provider is restricted to E2E builds.");
  }
}

function bridgeUrl() {
  const url = process.env.LIVE_CALL_TEST_PROVIDER_URL;

  if (!url) {
    return null;
  }

  const parsed = new URL(url);

  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
    throw new Error("The Live test provider must be a lane-owned loopback server.");
  }

  return parsed.origin;
}

/** @public Next E2E resolveAlias implements this compiler-owned provider interface. */
export function isLiveCallAvailable() {
  assertTestEnvironment();
  return true;
}

/** @public Next E2E resolveAlias implements this compiler-owned provider interface. */
export async function createLiveCallSession(input: {
  sdp: string;
  instructions: string;
  voice: string;
}) {
  assertTestEnvironment();
  const bridge = bridgeUrl();

  if (!bridge) {
    return { sdp: TEST_LIVE_SDP_ANSWER, sessionId: `live_e2e_${randomUUID()}` };
  }

  const response = await fetch(`${bridge}/sessions`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
  });

  const body: unknown = await response.json();
  const sdp = getString(body, "sdp");
  const sessionId = getString(body, "sessionId");

  if (!response.ok || !sdp || !sessionId) {
    throw new Error("The lane-owned Live peer could not answer SDP.");
  }

  return { sdp, sessionId };
}

/** @public Next E2E resolveAlias implements this compiler-owned provider interface. */
export async function closeLiveCallSession(sessionId: string) {
  assertTestEnvironment();
  const bridge = bridgeUrl();

  if (!bridge) {
    return { reason: "close_requested", seconds: 15, status: "closed" as const };
  }

  const response = await fetch(`${bridge}/sessions/${encodeURIComponent(sessionId)}/close`, {
    method: "POST",
    signal: AbortSignal.timeout(CLOSE_TIMEOUT_MS),
  });

  const body: unknown = await response.json();
  const seconds = getNumber(body, "seconds");

  if (
    !response.ok ||
    getString(body, "status") !== "closed" ||
    seconds === null ||
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    throw new Error("The lane-owned Live peer did not confirm closure.");
  }

  return { reason: "close_requested", seconds, status: "closed" as const };
}
