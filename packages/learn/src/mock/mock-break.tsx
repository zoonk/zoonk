"use client";

import { CoffeeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { formatClock } from "../_utils/clock";
import { useFormatDuration } from "../_utils/time-format";
import { TaskMainButton } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";

const TICK_MS = 1000;

/** The break's time left, ticking every second; when it runs out, the next section shows. */
function useBreakLeft(until: string): number {
  const { runner } = useMockScreen();
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, new Date(until).getTime() - now);
  const shown = useRef<string | null>(null);
  const showNext = useEffectEvent(() => void runner.endBreak());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Once per break: its clock already started the next section on the server.
  useEffect(() => {
    if (remaining === 0 && shown.current !== until) {
      shown.current = until;
      showNext();
    }
  }, [remaining, until]);

  return remaining;
}

/**
 * The break the notice gives between two sections, like the real exam's: its time left, the
 * section that comes next with its time and what may be used in it, and starting it early.
 */
export function MockBreak({ until }: { until: string }) {
  const t = useExtracted();
  const duration = useFormatDuration();
  const { runner } = useMockScreen();
  const remaining = useBreakLeft(until);
  const next = runner.view.sections.find((section) => section.status === "current");

  return (
    <MockFrame
      footer={
        <>
          <MockStepStatus />
          <TaskMainButton
            busy={runner.busy === "endBreak"}
            disabled={runner.pending}
            onClick={() => void runner.endBreak()}
          >
            {t("Start the next section")}
          </TaskMainButton>
        </>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <CoffeeIcon aria-hidden="true" className="text-muted-foreground size-8" />
        <h1 className="text-2xl font-bold">{t("Break")}</h1>
        {/* The server renders the clock a moment before the browser takes over. */}
        <p
          aria-label={t("Break time left")}
          className="text-4xl font-semibold tabular-nums"
          role="timer"
          suppressHydrationWarning
        >
          {formatClock(remaining)}
        </p>
        <p className="text-muted-foreground text-balance">
          {t("The next section starts on its own when the break ends.")}
        </p>
        {next && (
          <div className="bg-muted/50 flex w-full flex-col gap-1 rounded-2xl px-4 py-3 text-sm">
            <p className="font-medium">
              {next.name
                ? t("Next: {name} · {time}", { name: next.name, time: duration(next.minutes) })
                : t("Next section · {time}", { time: duration(next.minutes) })}
            </p>
            {next.tools && <p className="text-muted-foreground">{next.tools}</p>}
          </div>
        )}
      </div>
    </MockFrame>
  );
}
