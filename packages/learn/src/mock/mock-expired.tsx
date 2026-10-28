"use client";

import { TimerOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { TaskMainLink } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { MockEyebrow, MockFrame } from "./mock-frame";

export function MockExpired() {
  const t = useExtracted();
  const { hrefs } = useMockScreen();

  return (
    <MockFrame
      closeOnEscape
      footer={
        <TaskActions>
          <TaskMainLink href={hrefs.again}>{t("Take a new mock exam")}</TaskMainLink>
        </TaskActions>
      }
    >
      <StepCard>
        <TimerOffIcon aria-hidden="true" className="text-muted-foreground size-6" />

        <StepHeader>
          <MockEyebrow />
          <StepTitle>{t("Time ran out while you were away")}</StepTitle>
          <StepDetail>
            {t("With most of it unanswered, it isn't scored and doesn't change your preparation.")}
          </StepDetail>
        </StepHeader>
      </StepCard>
    </MockFrame>
  );
}
