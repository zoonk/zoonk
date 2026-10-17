"use client";

import { MOCK_ABANDONMENT_DELAY_MS } from "@zoonk/core/exams/mocks/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent } from "react";
import { formatClock } from "../_utils/clock";
import { useTimeLeft } from "../_utils/use-time-left";
import { useMockScreen } from "./mock-context";
import { useMockTitle } from "./mock-labels";

/** The section stops accepting answers at its deadline; grading waits for the learner's click. */
export function useIsSectionExpired(deadline?: string): boolean {
  return useTimeLeft({ deadline }) === 0;
}

/** Re-reads a stale sitting after the shared abandonment window and when its tab returns. Never hands it in. */
export function useRefreshPastMockDeadline({
  deadline,
  refresh,
}: {
  deadline?: string;
  refresh?: () => void;
}) {
  const refreshAfter = deadline ? new Date(deadline).getTime() + MOCK_ABANDONMENT_DELAY_MS : null;

  const readAgain = useEffectEvent(() => {
    if (
      refreshAfter !== null &&
      Date.now() > refreshAfter &&
      document.visibilityState === "visible"
    ) {
      refresh?.();
    }
  });

  useEffect(() => {
    if (refreshAfter === null || !refresh) {
      return;
    }

    const timer = setTimeout(() => readAgain(), Math.max(0, refreshAfter + 1 - Date.now()));
    window.addEventListener("focus", readAgain);
    document.addEventListener("visibilitychange", readAgain);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", readAgain);
      document.removeEventListener("visibilitychange", readAgain);
    };
  }, [refreshAfter, refresh]);
}

const CLOCK_CLASS = {
  aside: { box: "items-start", time: "text-[1.75rem] leading-8" },
  header: { box: "items-center", time: "text-[1.625rem] leading-8" },
} as const;

/**
 * The section's time left, big in the mono face, with a small "time left" under it: in the task's
 * header, or at the top of the answer sheet beside the question from `lg`. A timer isn't a live
 * region, so it never reads every second.
 */
export function SectionClock({
  className,
  deadline,
  place,
}: {
  className?: string;
  deadline: string;
  place: keyof typeof CLOCK_CLASS;
}) {
  const t = useExtracted();
  const remaining = useTimeLeft({ deadline });

  return (
    <div className={cn("flex flex-col", CLOCK_CLASS[place].box, className)}>
      {/* The server renders the clock a moment before the browser takes over. */}
      <p
        aria-label={t("Time left")}
        className={cn(
          "text-foreground font-mono font-medium tracking-[-0.02em] tabular-nums",
          CLOCK_CLASS[place].time,
        )}
        role="timer"
        suppressHydrationWarning
      >
        {formatClock(remaining)}
      </p>
      <p aria-hidden="true" className="text-muted-foreground text-[0.6875rem] leading-3.5">
        {t("time left")}
      </p>
    </div>
  );
}

/**
 * The task header's title, like an exam room's clock: the section's time left (the one header
 * allowed a second line). The mock's name is the page's heading, for screen readers while the
 * clock leads; where the clock moves to the answer sheet beside the question from `lg`
 * (`clockBeside`), the header shows the name instead.
 */
export function ClockTitle({
  clockBeside = false,
  deadline,
}: {
  clockBeside?: boolean;
  deadline: string;
}) {
  const { runner } = useMockScreen();
  const title = useMockTitle();

  return (
    <div className="flex min-w-0 shrink flex-col items-center text-center">
      <h1
        className={cn(
          "sr-only",
          clockBeside && "lg:not-sr-only lg:text-sm lg:leading-5 lg:font-medium lg:text-balance",
        )}
      >
        {title(runner.view)}
      </h1>
      <SectionClock className={cn(clockBeside && "lg:hidden")} deadline={deadline} place="header" />
    </div>
  );
}
