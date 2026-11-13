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
      footer={
        <TaskActions>
          <TaskMainLink href={hrefs.again}>{t("Take another")}</TaskMainLink>
        </TaskActions>
      }
    >
      <StepCard>
        <TimerOffIcon aria-hidden="true" className="text-muted-foreground size-6" />

        <StepHeader>
          <MockEyebrow />
          <StepTitle>{t("Time ran out while you were away")}</StepTitle>
          <StepDetail>{t("This one doesn't count.")}</StepDetail>
        </StepHeader>
      </StepCard>
    </MockFrame>
  );
}
