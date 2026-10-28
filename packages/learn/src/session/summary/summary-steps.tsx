"use client";

import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { StepDots } from "../../_components/step-dots";
import { StepsBackButton, focusStepTitle } from "../../_components/steps";
import { TaskActions } from "../../_components/task-layout";
import { isFocusLost } from "../../_utils/is-focus-lost";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { MomentAfterCeremony } from "../moment-ceremony";
import { OpenNextStep } from "../open-next-step";
import { SessionHeader } from "../session-header";
import {
  FinishLink,
  KeepGoingButton,
  KeepGoingFailed,
  SHARED_ROW_ACTION_CLASS,
  SeeMistakesLink,
  SummaryOptions,
  useKeepGoing,
} from "./summary-actions";
import { useIsStopped, useSessionSummary } from "./summary-context";
import { DoneStep } from "./summary-parts";
import { EarnedToday, RewardsStep, hasRewardsBeyondBrainPower } from "./summary-rewards";
import { useFirstSummaryVisit } from "./use-first-summary-visit";

const NO_STEP_LEFT = { done: false, rewards: false };

function useRewardsStep(stepRef: React.RefObject<HTMLElement | null>) {
  const stopped = useIsStopped();
  const { summary } = useSessionSummary();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(NO_STEP_LEFT);
  const opened = useRef(false);
  const exists = !stopped && hasRewardsBeyondBrainPower(summary);

  const close = () => {
    setLeft((steps) => ({ ...steps, rewards: true }));
    setOpen(false);
  };

  useKeyboardCallback("ArrowLeft", () => (open ? close() : false), { mode: "none", screen: true });

  useEffect(() => {
    if (opened.current || open) {
      opened.current = true;
      focusStepTitle(stepRef.current);
    }
  }, [open, stepRef]);

  const show = () => {
    setLeft((steps) => ({ ...steps, done: true }));
    setOpen(true);
  };

  return {
    close,
    exists,
    open: exists && open,
    revisited: exists && open ? left.rewards : left.done,
    show,
  };
}

function SummaryButtons({
  continuesToRewards,
  keepGoing,
  rewards,
}: {
  continuesToRewards: boolean;
  keepGoing: ReturnType<typeof useKeepGoing>;
  rewards: ReturnType<typeof useRewardsStep>;
}) {
  const t = useExtracted();
  const stopped = useIsStopped();
  const { mistakesHref, summary } = useSessionSummary();
  const canSeeMistakes = mistakesHref !== null && summary.mistakesSaved > 0;
  const crowded = stopped && canSeeMistakes;
  const sharedRow = crowded ? SHARED_ROW_ACTION_CLASS : undefined;

  return (
    <TaskActions className={crowded ? "max-lg:flex-wrap" : undefined}>
      {rewards.open && <StepsBackButton onClick={rewards.close} />}
      {!rewards.open && canSeeMistakes && (
        <SeeMistakesLink className={sharedRow} href={mistakesHref} />
      )}
      {stopped && <KeepGoingButton className={sharedRow} keepGoing={keepGoing} />}

      {continuesToRewards && (
        <TaskMainButton className="lg:hidden" onClick={rewards.show}>
          {t("Continue")}
        </TaskMainButton>
      )}

      <FinishLink className={continuesToRewards ? "max-lg:hidden" : undefined} />
    </TaskActions>
  );
}

export function SummarySteps() {
  const t = useExtracted();
  const stopped = useIsStopped();
  const { actions, ceremony, exitHref, summary } = useSessionSummary();
  const stepRef = useRef<HTMLDivElement>(null);
  const rewards = useRewardsStep(stepRef);
  const keepGoing = useKeepGoing();
  const firstVisit = useFirstSummaryVisit(summary);

  // "Stop for today" left with the screen before it, so a screen reader starts at the title.
  const shown = stopped || summary.finished;

  useEffect(() => {
    if (shown && isFocusLost(document.activeElement)) {
      focusStepTitle(stepRef.current);
    }
  }, [shown]);

  if (!stopped && !summary.finished) {
    return (
      <OpenNextStep
        exitHref={exitHref}
        header={<SessionHeader exitHref={exitHref} />}
        readNext={actions.refresh}
        status={t("Getting it ready…")}
      />
    );
  }

  const milestone = summary.ceremony;
  const continuesToRewards = rewards.exists && !rewards.open;

  return (
    <MomentAfterCeremony
      milestone={milestone}
      render={ceremony && milestone ? (_, close) => ceremony(milestone, close) : undefined}
    >
      <TaskFrame
        aside={{
          children: (
            <CelebrationScope play={firstVisit}>
              <EarnedToday />
            </CelebrationScope>
          ),
          label: t("Earned today"),
          title: t("Earned today"),
        }}
        closeOnEscape
        exitHref={exitHref}
        footer={
          <>
            <KeepGoingFailed keepGoing={keepGoing} />

            <SummaryButtons
              continuesToRewards={continuesToRewards}
              keepGoing={keepGoing}
              rewards={rewards}
            />

            <SummaryOptions lastStep={!continuesToRewards} />
          </>
        }
        headerTitle={
          rewards.exists ? (
            <StepDots className="lg:hidden" current={rewards.open ? 1 : 0} total={2} />
          ) : null
        }
      >
        <div
          className="flex flex-col gap-4"
          data-slot="steps-step"
          key={rewards.open ? "rewards" : "done"}
          ref={stepRef}
        >
          <CelebrationScope play={firstVisit && !rewards.revisited}>
            {rewards.open ? <RewardsStep /> : <DoneStep />}
          </CelebrationScope>
        </div>
      </TaskFrame>
    </MomentAfterCeremony>
  );
}
