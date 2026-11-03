"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun, toHeldRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { type ReadyHoldControl, useReadyHold } from "../../warm-up/use-ready-hold";
import { type OnboardingActions } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { HeldFooter } from "./held-wait";
import { isRunStopped } from "./wait-run";
import { WaitWarmUp } from "./wait-warm-up";

/** Where the learner goes once the plan is ready: the time question, or the plan itself. */
type PlanNext = "plan" | "timeQuestion";

function PlanBuildingDescription({
  holding,
  next,
  run,
}: {
  holding: boolean;
  next: PlanNext;
  run: GenerationRun;
}) {
  const t = useExtracted();

  if (holding) {
    return next === "plan"
      ? t("See it whenever you're ready.")
      : t("One last question, then you'll see it.");
  }

  return isRunStopped(run)
    ? t("Your answers are saved.")
    : t(
        "We're choosing what to learn first and fitting it into your days. A new subject can take a minute or two.",
      );
}

export function PlanBuilding({
  children,
  hold,
  next,
  readWarmUp,
  run,
}: {
  children?: React.ReactNode;
  /** Where the plan's wait can deal warm-up cards and hold once it's ready. */
  hold?: ReadyHoldControl;
  next: PlanNext;
  readWarmUp?: OnboardingActions["readWarmUp"];
  run: GenerationRun;
}) {
  const t = useExtracted();
  const holding = hold?.status === "hold";

  return (
    <OnboardingColumn>
      <GenerationWait
        doneLabel={holding ? t("Your plan is ready") : undefined}
        kind="curriculum"
        run={holding ? toHeldRun(run) : run}
      >
        <OnboardingHeading>
          <OnboardingTitle>
            {holding ? t("Your plan is ready") : t("Building your plan")}
          </OnboardingTitle>
          <OnboardingDescription>
            <PlanBuildingDescription holding={holding} next={next} run={run} />
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>

      {children}

      {hold && readWarmUp && (
        <WaitWarmUp hold={hold} read={readWarmUp} surface="planWait" warmUpId={run.warmUpId} />
      )}

      {hold && holding && (
        <HeldFooter onContinue={hold.release}>
          {next === "plan" ? t("See your plan") : t("Continue")}
        </HeldFooter>
      )}
    </OnboardingColumn>
  );
}

/**
 * The plan's build wait, then `children` once it moves on. Its hold lives as long as this wait is on
 * screen, so a guess here doesn't hold a later screen when another wait (an exam's notice) comes
 * between.
 */
export function PlanWait({
  children,
  next,
  offer,
  readWarmUp,
  ready,
  run,
}: {
  children: React.ReactNode;
  next: PlanNext;
  /** Shown under the timeline, above the warm-up card. */
  offer?: React.ReactNode;
  readWarmUp: OnboardingActions["readWarmUp"];
  ready: boolean;
  run: GenerationRun;
}) {
  const hold = useReadyHold(ready);

  if (hold.status === "go") {
    return children;
  }

  return (
    <PlanBuilding hold={hold} next={next} readWarmUp={readWarmUp} run={run}>
      {offer}
    </PlanBuilding>
  );
}
