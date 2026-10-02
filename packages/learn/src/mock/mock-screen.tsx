"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useExperienceMode } from "../mode-provider";
import { TaskMainButton } from "../shell/task-frame";
import { type MockActions, type MockHrefs, MockProvider, useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { MockIntro } from "./mock-intro";
import { MockMoved } from "./mock-moved";
import { MockResultView } from "./mock-result-view";
import { MockRunnerView } from "./mock-runner-view";
import { useMockRunner } from "./use-mock-runner";

export type { MockActions } from "./mock-context";

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
        <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-bold">
          {t("Mock exam handed in")}
        </h1>
        <p className="text-muted-foreground">{t("Your answers are saved.")}</p>
      </div>
    </MockFrame>
  );
}

function MockStage() {
  const { runner } = useMockScreen();
  const { view } = runner;

  if (runner.moved) {
    return <MockMoved />;
  }

  if (view.status === "finished") {
    return <MockResultView />;
  }

  if (view.status === "running") {
    return view.current ? <MockRunnerView /> : <MockGrading />;
  }

  return <MockIntro />;
}

/**
 * A mock exam in real conditions, from its intro to its result: the week's Big Challenge in Fun
 * and the weekly mock exam in Focus, with the same sections, clock, scoring and analysis. The host
 * supplies the mock's view model, how to reach the server, where to go next and, in Fun, the buddy.
 */
export function MockScreen({
  actions,
  ask,
  hrefs,
  mock,
  buddy,
}: {
  actions: MockActions;
  /** "Ask" about the result, such as the player's `AskTutor`; it shows once the mock is over. */
  ask?: React.ReactNode;
  hrefs: MockHrefs;
  mock: MockView;
  buddy: LearnBuddy | null;
}) {
  const mode = useExperienceMode();
  const runner = useMockRunner({ actions, initial: mock });

  return (
    <MockProvider value={{ ask, buddy: mode === "fun" ? buddy : null, hrefs, runner }}>
      <MockStage />
    </MockProvider>
  );
}
