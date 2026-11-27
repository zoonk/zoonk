"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useTimeLeft } from "../_utils/use-time-left";
import { useLines } from "./comes-back-words";
import { type LimitWords, type SlowDown } from "./help-limit-notice";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/**
 * A slow-down's wait ends at the instant the screen was given (`availableAt`), or counted from when
 * the refusal arrived, or else from when its notice first showed.
 */
function useSlowDownEnd(limit: SlowDown | null): number | null {
  const shownAt = useMountTime().getTime();

  if (!limit) {
    return null;
  }

  return limit.availableAt
    ? Date.parse(limit.availableAt)
    : (limit.receivedAt ?? shownAt) + limit.retryAfterSeconds * MS_PER_SECOND;
}

function useWaitLine() {
  const t = useExtracted("limits");
  const { ready } = useLines();

  return (seconds: number): string => {
    if (seconds <= 0) {
      return ready();
    }

    if (seconds < SECONDS_PER_MINUTE) {
      return t({
        description:
          "The line of a notice that the learner sent too many requests in a short time, such as questions to their study buddy, and must wait before the next one. It counts down every second until they can try again.",
        message:
          "Take a short break. You can try again in {seconds, plural, one {# second} other {# seconds}}.",
        values: { seconds },
      });
    }

    return t({
      description:
        "The line of a notice that the learner sent too many requests in a short time, such as questions to their study buddy, and must wait before the next one. It counts down every minute until they can try again.",
      message:
        "Take a short break. You can try again in {minutes, plural, one {# minute} other {# minutes}}.",
      values: { minutes: Math.ceil(seconds / SECONDS_PER_MINUTE) },
    });
  };
}

/**
 * A slow-down's line names the wait and counts it down, in seconds under a minute and in minutes
 * above, until it says the learner can try again. A screen reader hears the wait it was first given
 * once (`said`), not every second, and hears again only when the wait is over.
 */
export function useSlowDownWords(limit: SlowDown | null): LimitWords | null {
  const end = useSlowDownEnd(limit);
  const left = useTimeLeft({ deadline: end });
  const seconds = Math.ceil(left / MS_PER_SECOND);
  const waitLine = useWaitLine();
  const line = end === null ? null : waitLine(seconds);
  const [first, setFirst] = useState({ end, said: line });

  if (first.end !== end) {
    setFirst({ end, said: line });
  }

  if (line === null) {
    return null;
  }

  return { line, said: seconds > 0 && first.end === end ? (first.said ?? line) : line };
}
