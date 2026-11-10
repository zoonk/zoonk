import { type LessonClockInput } from "@zoonk/core/lesson-player/clock-contract";

export type LessonClock = { delivery: "failed" | "sending" | "sent"; transition: LessonClockInput };

/** A successful Start runs a fresh clock on the server at sequence 0; a lesson outside a study block has none. */
export function startClock({
  clockId,
  runId,
}: {
  clockId: string | null;
  runId: string;
}): LessonClock | null {
  return clockId
    ? { delivery: "sent", transition: { clockId, runId, sequence: 0, state: "running" } }
    : null;
}

/** The clock with the transition to send now, or null when there's none: a failed one goes again under its sequence. */
export function moveClock(
  clock: LessonClock | null,
  state: LessonClockInput["state"],
): LessonClock | null {
  if (!clock) {
    return null;
  }

  const { delivery, transition } = clock;

  if (transition.state !== state) {
    return {
      delivery: "sending",
      transition: { ...transition, sequence: transition.sequence + 1, state },
    };
  }

  return delivery === "failed" ? { delivery: "sending", transition } : null;
}

export function settleClock({
  clock,
  delivered,
  sent,
}: {
  clock: LessonClock | null;
  delivered: boolean;
  sent: LessonClockInput;
}): LessonClock | null {
  return clock?.transition === sent
    ? { delivery: delivered ? "sent" : "failed", transition: sent }
    : clock;
}
