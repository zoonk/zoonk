"use client";

import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StepCard, StepDetail, StepHeader } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { formatClock } from "../_utils/clock";
import { useFormatDuration } from "../_utils/time-format";
import { TaskMainButton } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { SheetSections, hasSeveralSections } from "./mock-sheet-sections";

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
 * The break the notice gives between two sections, like the real exam's, straight on the page:
 * its time left big in the mono face, the section that comes next as one row (what may be used in
 * it under its name, its time in the mono face at its end), and starting it early. From `lg` the
 * sitting's sections are beside it, the ones handed in and the one next, as the answer sheet
 * lists them.
 */
export function MockBreak({ until }: { until: string }) {
  const t = useExtracted();
  const duration = useFormatDuration();
  const { runner } = useMockScreen();
  const remaining = useBreakLeft(until);
  const next = runner.view.sections.find((section) => section.status === "current");

  return (
    <MockFrame
      aside={
        hasSeveralSections(runner.view.sections)
          ? {
              children: <SheetSections titled={false} />,
              label: t("Sections"),
              title: t("Sections"),
            }
          : null
      }
      footer={
        <>
          <MockStepStatus />
          <TaskActions>
            <TaskMainButton
              busy={runner.busy === "endBreak"}
              disabled={runner.pending}
              onClick={() => void runner.endBreak()}
            >
              {t("Start the next section")}
            </TaskMainButton>
          </TaskActions>
        </>
      }
    >
      <StepCard>
        <StepHeader>
          <h1 className="text-label">{t("Break")}</h1>
          {/* The server renders the clock a moment before the browser takes over. */}
          <p
            aria-label={t("Break time left")}
            className="font-mono text-5xl font-medium tracking-[-0.04em] tabular-nums"
            role="timer"
            suppressHydrationWarning
          >
            {formatClock(remaining)}
          </p>
          <StepDetail>{t("The next section starts on its own when the break ends.")}</StepDetail>
        </StepHeader>

        {next && (
          <ListGroup className="border-border w-full border-y">
            <ListRow>
              <ListRowContent>
                <ListRowTitle>
                  {next.name ? t("Next: {name}", { name: next.name }) : t("Next section")}
                </ListRowTitle>
                {next.tools && <ListRowDescription>{next.tools}</ListRowDescription>}
              </ListRowContent>
              <ListRowTrailing>{duration(next.minutes)}</ListRowTrailing>
            </ListRow>
          </ListGroup>
        )}
      </StepCard>
    </MockFrame>
  );
}
