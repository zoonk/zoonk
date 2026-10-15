import { z } from "zod";

/**
 * A follow's answer: the learner's revision when the day moved, or, when it couldn't move, when it
 * may ask again (`retryAt`, server time: the learner's next day once they studied today, else now).
 */
const timeZoneFollowSchema = z.union([
  z.object({ learnerRevision: z.string(), moved: z.literal(true) }),
  z.object({ moved: z.literal(false), retryAt: z.number() }),
]);

type TimeZoneFollow = z.infer<typeof timeZoneFollowSchema>;

/**
 * A goal's last follow of one device zone on this page: which ask it is (`request`), for which
 * zone, and until when it stands. While it's out (`inFlight`), nothing asks again for that zone; once answered,
 * until the learner summary catches up with the move's revision, or until a summary read at the
 * moment the day may move (`readAt`).
 */
export type SentTimeZoneFollow = {
  request: number;
  timeZone: string;
  until: { inFlight: true } | { learnerRevision: string } | { readAt: number };
};

/**
 * Whether Today asks to follow the device's zone: the summary says the goal's saved zone isn't the
 * device's, and no follow of that zone is out or waiting for the summary to catch up (so a summary
 * read while it's out, or Today mounting again, never asks twice).
 *
 * @internal
 */
export function shouldFollowTimeZone({
  deviceZone,
  sent,
  summary,
}: {
  deviceZone: string;
  sent?: SentTimeZoneFollow;
  summary: { readAt: number; revision: string; timeZone: string | null };
}): boolean {
  if (summary.timeZone === deviceZone) {
    return false;
  }

  if (!sent || sent.timeZone !== deviceZone) {
    return true;
  }

  const { until } = sent;

  if ("inFlight" in until) {
    return false;
  }

  return "learnerRevision" in until
    ? BigInt(summary.revision) >= BigInt(until.learnerRevision)
    : summary.readAt >= until.readAt;
}

/**
 * The follow a goal holds once an ask answers (`result`) or fails (null): only that ask's own answer
 * settles it, so a late answer for an older zone never overwrites a newer ask. Undefined after a
 * failure, so the next summary may ask again.
 *
 * @internal
 */
export function settleTimeZoneFollow({
  held,
  request,
  result,
}: {
  held?: SentTimeZoneFollow;
  request: SentTimeZoneFollow;
  result: TimeZoneFollow | null;
}): SentTimeZoneFollow | undefined {
  if (held?.request !== request.request) {
    return held;
  }

  if (!result) {
    return undefined;
  }

  return {
    ...request,
    until: result.moved ? { learnerRevision: result.learnerRevision } : { readAt: result.retryAt },
  };
}

/** Where a page keeps a goal's follow of one device zone. */
function toFollowKey(goalId: string, timeZone: string): string {
  return `${goalId} ${timeZone}`;
}

/**
 * A page's follows, one per goal and device zone: `begin` starts an ask when one is due (and says
 * which), `settle` takes its answer. A zone's ask still out blocks another of that zone, even after
 * the device moved on to another zone and came back.
 */
export function createTimeZoneFollows() {
  const follows = new Map<string, SentTimeZoneFollow>();
  let lastRequest = 0;

  return {
    begin({
      deviceZone,
      goalId,
      summary,
    }: {
      deviceZone: string;
      goalId: string;
      summary: { readAt: number; revision: string; timeZone: string | null };
    }): SentTimeZoneFollow | undefined {
      const key = toFollowKey(goalId, deviceZone);

      if (!shouldFollowTimeZone({ deviceZone, sent: follows.get(key), summary })) {
        return undefined;
      }

      lastRequest += 1;

      const request: SentTimeZoneFollow = {
        request: lastRequest,
        timeZone: deviceZone,
        until: { inFlight: true },
      };

      follows.set(key, request);
      return request;
    },

    settle({
      goalId,
      request,
      result,
    }: {
      goalId: string;
      request: SentTimeZoneFollow;
      result: TimeZoneFollow | null;
    }): void {
      const key = toFollowKey(goalId, request.timeZone);
      const settled = settleTimeZoneFollow({ held: follows.get(key), request, result });

      if (settled) {
        follows.set(key, settled);
      } else {
        follows.delete(key);
      }
    },
  };
}

/** Asks Main to follow the device's zone for a goal (`POST /api/goals/[goalId]/time-zone`). */
export async function requestTimeZoneFollow({
  goalId,
  timeZone,
}: {
  goalId: string;
  timeZone: string;
}): Promise<TimeZoneFollow> {
  const response = await fetch(`/api/goals/${goalId}/time-zone`, {
    body: JSON.stringify({ timeZone }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Following the time zone failed with ${response.status}`);
  }

  return timeZoneFollowSchema.parse(await response.json());
}
