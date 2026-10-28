import { LIVE_CALL_CREATE_TIMEOUT_MS } from "@zoonk/ai/tasks/v2/language/live-call-creation";
import { type LiveCallConnection } from "@zoonk/db";
import {
  LIVE_CALL_CONNECT_WINDOW_SECONDS,
  getLiveCallCostMicros,
} from "../../../entitlements/limits";

const MS_PER_SECOND = 1000;

/**
 * The longest OpenAI can bill one session: it ends a Live session about 2 hours after it starts
 * (its `expires_at`, measured on 2026-10-27), plus the creation request's own time. A call whose
 * hangups kept failing costs no more than this, however late someone ends it.
 */
const LONGEST_BILLED_SECONDS = 2 * 60 * 60 + (2 * LIVE_CALL_CREATE_TIMEOUT_MS) / MS_PER_SECOND;

function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / MS_PER_SECOND));
}

/** The seconds OpenAI may have billed since creation was asked for. */
function billedSeconds(startedAt: Date, now: Date): number {
  return Math.min(LONGEST_BILLED_SECONDS, secondsBetween(startedAt, now));
}

/** A reservation is worth something only while its SDP offer can still come. */
export function isWithinConnectWindow({
  connection,
  now,
}: {
  connection: Pick<LiveCallConnection, "createdAt">;
  now: Date;
}): boolean {
  return (
    now.getTime() <
    connection.createdAt.getTime() + LIVE_CALL_CONNECT_WINDOW_SECONDS * MS_PER_SECOND
  );
}

/**
 * What a connection may have cost by `now`, from its timestamps alone: its settled cost once
 * ended, its reservation while it waits for its offer (nothing past the connect window), and once
 * creation was asked for, the larger of its reservation and the provider's clock, up to the longest
 * a session lives. A call whose hangup keeps failing keeps adding its overrun, so budget decisions
 * count it.
 */
export function getCallExposureMicros({
  connection,
  now,
}: {
  connection: LiveCallConnection;
  now: Date;
}): number {
  if (connection.state === "ended") {
    return connection.costMicros;
  }

  if (connection.state === "reserved") {
    return isWithinConnectWindow({ connection, now }) ? connection.costMicros : 0;
  }

  if (!connection.startedAt) {
    return connection.costMicros;
  }

  return Math.max(
    connection.costMicros,
    getLiveCallCostMicros(billedSeconds(connection.startedAt, now)),
  );
}

/**
 * What a connection ending at `now` costs, and how much of the learner's call time it keeps, when
 * no provider answer says otherwise:
 * - a reservation that never asked for a session costs nothing;
 * - a creation that never named its session (it timed out, or the server stopped mid-way) is an
 *   estimate: nothing documents that withholding the SDP answer caps billing, so it keeps the
 *   larger of its reservation and the clock;
 * - a session that existed, now hung up, costs its clock, beyond what it held (any overrun is ours)
 *   up to the longest a session lives. Only one the browser got keeps the learner's time, up to
 *   what it held.
 */
export function getEndingCharge({
  connection,
  now,
}: {
  connection: LiveCallConnection;
  now: Date;
}): { costMicros: number; learnerSeconds: number } {
  if (connection.state === "reserved" || !connection.startedAt) {
    return { costMicros: 0, learnerSeconds: 0 };
  }

  const elapsed = secondsBetween(connection.startedAt, now);
  const clockMicros = getLiveCallCostMicros(billedSeconds(connection.startedAt, now));

  if (!connection.providerSessionId) {
    return { costMicros: Math.max(connection.costMicros, clockMicros), learnerSeconds: 0 };
  }

  return {
    costMicros: clockMicros,
    learnerSeconds: connection.state === "live" ? Math.min(connection.heldSeconds, elapsed) : 0,
  };
}
