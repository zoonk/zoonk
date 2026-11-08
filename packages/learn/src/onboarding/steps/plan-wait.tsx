"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type GenerationRun } from "../../generation/generation-run";
import { useReadyHold } from "../../warm-up/use-ready-hold";
import { type OnboardingActions } from "../onboarding-actions";
import { useOnboardingWait } from "../onboarding-clock";
import { OnboardingColumn } from "../onboarding-frame";
import { HeldFooter } from "./held-wait";
import { NoticeReading } from "./notice-reading";
import { PlanBuilding, type PlanNext } from "./plan-building";
import { type PlanWaitScreen, type WaitStop } from "./wait-run";
import { WaitWarmUp } from "./wait-warm-up";

type PlanWaitProps = {
  children: React.ReactNode;
  next: PlanNext;
  notice?: { document: ExamDocument; lastNotice: boolean; stopped: WaitStop | null };
  /** Shown under the build wait's timeline, above the warm-up card. */
  offer?: React.ReactNode;
  readWarmUp: OnboardingActions["readWarmUp"];
  run: GenerationRun;
};

/** The notice's wait comes after the plan is built, so once it showed, it's the one that may hold. */
function useWaitScreen(wait: PlanWaitScreen | null): PlanWaitScreen {
  const [noticeShown, setNoticeShown] = useState(wait === "notice");

  if (wait === "notice" && !noticeShown) {
    setNoticeShown(true);
  }

  return noticeShown ? "notice" : "building";
}

function ScreenWait({
  children,
  next,
  notice,
  offer,
  readWarmUp,
  ready,
  run,
  screen,
}: PlanWaitProps & { ready: boolean; screen: PlanWaitScreen }) {
  const t = useExtracted();
  const hold = useReadyHold(ready);
  const holding = hold.status === "hold";
  useOnboardingWait(screen === "notice" ? "examNotice" : "planWait", hold.status !== "go");

  if (hold.status === "go") {
    return children;
  }

  return (
    <OnboardingColumn>
      {screen === "notice" && notice ? (
        <NoticeReading {...notice} holding={holding} next={next} />
      ) : (
        <>
          <PlanBuilding holding={holding} next={next} run={run} />
          {offer}
        </>
      )}

      <WaitWarmUp hold={hold} read={readWarmUp} surface="planWait" warmUpId={run.warmUpId} />

      {holding && (
        <HeldFooter onContinue={hold.release}>
          {next === "plan" ? t("See your plan") : t("Continue")}
        </HeldFooter>
      )}
    </OnboardingColumn>
  );
}

/**
 * The plan's waits (its build, then its exam's notice being read), then `children` once they move
 * on. Each wait screen holds on its own guesses: one on the build wait doesn't hold the notice's
 * wait that comes after it.
 */
export function PlanWait({ wait, ...props }: PlanWaitProps & { wait: PlanWaitScreen | null }) {
  const screen = useWaitScreen(wait);

  return <ScreenWait key={screen} {...props} ready={wait === null} screen={wait ?? screen} />;
}
