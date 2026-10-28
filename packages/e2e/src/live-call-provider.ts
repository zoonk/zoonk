import { randomUUID } from "node:crypto";
import { getString, isJsonObject } from "@zoonk/utils/json";

const CREATE_TIMEOUT_MS = 30_000;
const HANGUP_TIMEOUT_MS = 15_000;
const NOT_FOUND = 404;

export const TEST_LIVE_SDP_ANSWER = "v=0\r\ns=e2e-provider-peer\r\n";

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

/** Like OpenAI, the peer answers a session that already ended with 404 `session_id_not_found`. */
async function isAlreadyEnded(response: Response): Promise<boolean> {
  if (response.status !== NOT_FOUND) {
    return false;
  }

  const body: unknown = await response.json().catch(() => null);
  return getString(isJsonObject(body) ? body.error : null, "code") === "session_id_not_found";
}

/** @public Next E2E resolveAlias implements this compiler-owned provider interface. */
export async function hangUpLiveCallSession(sessionId: string) {
  assertTestEnvironment();
  const bridge = bridgeUrl();

  if (!bridge) {
    return;
  }

  const response = await fetch(`${bridge}/sessions/${encodeURIComponent(sessionId)}/hangup`, {
    method: "POST",
    signal: AbortSignal.timeout(HANGUP_TIMEOUT_MS),
  });

  if (!response.ok && !(await isAlreadyEnded(response))) {
    throw new Error("The lane-owned Live peer didn't hang up.");
  }
}
