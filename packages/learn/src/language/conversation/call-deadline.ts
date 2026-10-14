import { LIVE_CALL_GRACE_SECONDS } from "@zoonk/core/entitlements/limits";

const MS_PER_SECOND = 1000;

/**
 * When the call's own length ends, from the server's reservation: the seconds it held, counted
 * from when its answer arrived (`now`), and never past its absolute deadline less the goodbye and
 * closing time the server keeps after it. Connecting comes out of the call's time, so neither a
 * slow answer nor a reconnect starts the call's clock over.
 */
export function getCallEndsAt({
  deadlineAt,
  now,
  seconds,
}: {
  deadlineAt: string;
  now: number;
  seconds: number;
}): number {
  return Math.min(
    now + seconds * MS_PER_SECOND,
    Date.parse(deadlineAt) - LIVE_CALL_GRACE_SECONDS * MS_PER_SECOND,
  );
}
