"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { TimerOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
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

/**
 * Every section was handed in but grading didn't finish (the tab closed first): one line says it's
 * in, and one tap grades it now.
 */
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

/**
 * A clock never starts grading: time closes the answers, and the learner hands them in. It says
 * the answers are saved only when they are; the bar says what isn't.
 */
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

/**
 * A started mock exam in real conditions, to its result: its sections, clock, scoring and
 * analysis. Its challenge page introduces and starts it. The host supplies the mock's view model,
 * how to reach the server and where to go next.
 */
export function MockScreen({
  actions,
  ask,
  buddy,
  hrefs,
  mock,
}: {
  actions: MockActions;
  /** "Ask" about the result, such as the player's `AskTutor`; it shows once the mock is over. */
  ask?: React.ReactNode;
  /** The learner's buddy, who cheers when the mock completes one of the day's missions. */
  buddy?: LearnBuddy | null;
  hrefs: MockHrefs;
  mock: MockView;
}) {
  const runner = useMockRunner({ actions, initial: mock });

  return (
    <MockProvider value={{ actions, ask, buddy, hrefs, runner }}>
      <MockStage />
    </MockProvider>
  );
}
