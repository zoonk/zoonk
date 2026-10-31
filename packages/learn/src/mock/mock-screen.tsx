"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { TimerOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type MomentCeremony } from "../session/moment-ceremony";
import { TaskMainButton } from "../shell/task-frame";
import { MockBreak } from "./mock-break";
import { useRefreshPastMockDeadline } from "./mock-clock";
import { type MockActions, type MockHrefs, MockProvider, useMockScreen } from "./mock-context";
import { MockExpired } from "./mock-expired";
import { MockEyebrow, MockFrame, MockStepStatus } from "./mock-frame";
import { MockResultView } from "./mock-result-view";
import { MockRunnerView } from "./mock-runner-view";
import { MockSpeakingView } from "./mock-speaking";
import { useMockRunner } from "./use-mock-runner";

export type {
  MockActions,
  MockEssayGrading,
  MockPlanOfferOutcome,
  MockPlayOutcome,
} from "./mock-context";

function MockGrading() {
  const t = useExtracted();
  const { runner } = useMockScreen();

  return (
    <MockFrame
      footer={
        <>
          <MockStepStatus />
          <TaskActions>
            <TaskMainButton
              busy={runner.busy === "finish"}
              disabled={runner.pending}
              onClick={() => void runner.finish()}
            >
              {runner.busy === "finish" ? t("Grading…") : t("See how it went")}
            </TaskMainButton>
          </TaskActions>
        </>
      }
    >
      <StepTitle>{t("Mock exam handed in")}</StepTitle>
    </MockFrame>
  );
}

/** A clock never starts grading: time closes the answers, and the learner hands them in. */
function MockTimeUp() {
  const t = useExtracted();
  const { actions, runner } = useMockScreen();
  const isLast = runner.view.current?.section === runner.view.sections.length - 1;
  const handingIn = runner.busy === "submit";
  const action = isLast ? t("See how it went") : t("Continue");
  useRefreshPastMockDeadline({ deadline: runner.view.current?.deadline, refresh: actions.refresh });

  return (
    <MockFrame
      footer={
        <>
          <MockStepStatus />
          <TaskActions>
            <TaskMainButton
              busy={handingIn}
              disabled={runner.pending}
              onClick={() => void runner.submitSection()}
            >
              {handingIn ? t("Handing in…") : action}
            </TaskMainButton>
          </TaskActions>
        </>
      }
    >
      <StepCard>
        <TimerOffIcon aria-hidden="true" className="text-muted-foreground size-6" />

        <StepHeader>
          <MockEyebrow />
          <StepTitle>{t("Time's up")}</StepTitle>
          {runner.saveStatus === "saved" && (
            <StepDetail>{t("Your answers so far are saved.")}</StepDetail>
          )}
        </StepHeader>
      </StepCard>
    </MockFrame>
  );
}

function MockStage() {
  const { runner } = useMockScreen();
  const { view } = runner;

  if (view.status === "expired") {
    return <MockExpired />;
  }

  if (view.status === "finished") {
    return <MockResultView />;
  }

  if (view.breakUntil && !view.current) {
    return <MockBreak until={view.breakUntil} />;
  }

  if (view.current && runner.timeUp) {
    return <MockTimeUp />;
  }

  if (view.current?.kind === "speaking") {
    return <MockSpeakingView />;
  }

  return view.current ? <MockRunnerView /> : <MockGrading />;
}

export function MockScreen({
  actions,
  ask,
  buddy,
  hrefs,
  mock,
  renderCeremony,
}: {
  actions: MockActions;
  ask?: React.ReactNode;
  buddy?: LearnBuddy | null;
  hrefs: MockHrefs;
  mock: MockView;
  renderCeremony?: MomentCeremony;
}) {
  const runner = useMockRunner({ actions, initial: mock });
  // oxlint-disable-next-line react/hook-use-state -- Read once as the screen opens, never updated.
  const [openedFinished] = useState(mock.status === "finished");

  return (
    <MockProvider value={{ actions, ask, buddy, hrefs, renderCeremony, runner }}>
      <CelebrationScope play={!openedFinished}>
        <MockStage />
      </CelebrationScope>
    </MockProvider>
  );
}
