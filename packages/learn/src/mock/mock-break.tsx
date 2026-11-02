"use client";

import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { formatClock } from "../_utils/clock";
import { useFormatDuration } from "../_utils/time-format";
import { useTimeLeft } from "../_utils/use-time-left";
import { TaskMainButton } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { SheetSections, hasSeveralSections } from "./mock-sheet-sections";

export function MockBreak({ until }: { until: string }) {
  const t = useExtracted();
  const duration = useFormatDuration();
  const { runner } = useMockScreen();
  // When the break ends, its clock already started the next section on the server; this shows it.
  const remaining = useTimeLeft({ deadline: until, onTimeUp: () => void runner.endBreak() });
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
          <StepTitle>{t("Break")}</StepTitle>
          {/* The server renders the clock a moment before the browser takes over. */}
          <p
            aria-label={t("Break time left")}
            className="text-readout pt-3 text-5xl"
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
