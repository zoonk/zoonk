import { LIVE_CALL_CREATE_TIMEOUT_MS } from "@zoonk/ai/tasks/language/live-call-creation";
import { type LiveCallConnection } from "@zoonk/db";
import {
  LIVE_CALL_CONNECT_WINDOW_SECONDS,
  getLiveCallCostMicros,
} from "../../../entitlements/limits";

const MS_PER_SECOND = 1000;

/** OpenAI sessions have been observed to expire after about two hours; allow for creation time too. */
const LONGEST_BILLED_SECONDS = 2 * 60 * 60 + (2 * LIVE_CALL_CREATE_TIMEOUT_MS) / MS_PER_SECOND;

function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / MS_PER_SECOND));
}

function billedSeconds(startedAt: Date, now: Date): number {
  return Math.min(LONGEST_BILLED_SECONDS, secondsBetween(startedAt, now));
}

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

/** Admission, the app's countdown and the learner's charge all end the talk time here. */
export function getTalkEndsAt(
  connection: Pick<LiveCallConnection, "createdAt" | "heldSeconds">,
): number {
  return connection.createdAt.getTime() + connection.heldSeconds * MS_PER_SECOND;
}

/** The learner pays for the part of the live time inside the talk window, never the wrap-up after it. */
function getTalkSeconds({
  connection,
  liveUntil,
  startedAt,
}: {
  connection: LiveCallConnection;
  liveUntil: Date;
  startedAt: Date;
}): number {
  return secondsBetween(
    startedAt,
    new Date(Math.min(liveUntil.getTime(), getTalkEndsAt(connection))),
  );
}

export function getEndingCharge({
  connection,
  liveUntil,
  now,
}: {
  connection: LiveCallConnection;
  liveUntil?: Date;
  now: Date;
}): { costMicros: number; learnerSeconds: number } {
  const { startedAt } = connection;

  if (connection.state === "reserved" || !startedAt) {
    return { costMicros: 0, learnerSeconds: 0 };
  }

  const clockMicros = getLiveCallCostMicros(billedSeconds(startedAt, now));

  if (!connection.providerSessionId) {
    return { costMicros: Math.max(connection.costMicros, clockMicros), learnerSeconds: 0 };
  }

  return {
    costMicros: clockMicros,
    learnerSeconds:
      connection.state === "live"
        ? getTalkSeconds({ connection, liveUntil: liveUntil ?? now, startedAt })
        : 0,
  };
}
