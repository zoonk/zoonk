"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { TaskMainButton } from "../shell/task-frame";
import { type MockActions, type MockHrefs, MockProvider, useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { MockResultView } from "./mock-result-view";
import { MockRunnerView } from "./mock-runner-view";
import { useMockRunner } from "./use-mock-runner";

export type { MockActions, MockPlanOfferOutcome } from "./mock-context";

/** Every section was handed in but grading didn't finish: one tap grades it now. */
function MockGrading() {
  const t = useExtracted();
  const { runner } = useMockScreen();

  return (
    <MockFrame
      footer={
        <>
          <MockStepStatus />
          <TaskMainButton
            busy={runner.busy === "finish"}
            disabled={runner.pending}
            onClick={() => void runner.finish()}
          >
            {runner.busy === "finish" ? t("Grading…") : t("See how it went")}
          </TaskMainButton>
        </>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t("Mock exam handed in")}</h1>
        <p className="text-muted-foreground">{t("Your answers are saved.")}</p>
      </div>
    </MockFrame>
  );
}

function MockStage() {
  const { runner } = useMockScreen();
  const { view } = runner;

  if (view.status === "finished") {
    return <MockResultView />;
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
  hrefs,
  mock,
}: {
  actions: MockActions;
  /** "Ask" about the result, such as the player's `AskTutor`; it shows once the mock is over. */
  ask?: React.ReactNode;
  hrefs: MockHrefs;
  mock: MockView;
}) {
  const runner = useMockRunner({ actions, initial: mock });

  return (
    <MockProvider value={{ actions, ask, hrefs, runner }}>
      <MockStage />
    </MockProvider>
  );
}
