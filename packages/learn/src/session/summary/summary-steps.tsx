"use client";

import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { StepDots } from "../../_components/step-dots";
import { StepsBackButton, focusStepTitle } from "../../_components/steps";
import { TaskActions } from "../../_components/task-layout";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
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

/**
 * The phone's second step, what the day earned, when it earned more than its Brain Power: Continue
 * opens it, Back (or ←) returns. Wide screens show it in the aside instead, so their main action
 * is Finish from the first screen.
 */
function useRewardsStep(stepRef: React.RefObject<HTMLElement | null>) {
  const stopped = useIsStopped();
  const { summary } = useSessionSummary();
  const [open, setOpen] = useState(false);
  const opened = useRef(false);
  const exists = !stopped && hasRewardsBeyondBrainPower(summary);

  useKeyboardCallback("ArrowLeft", () => (open ? setOpen(false) : false), {
    mode: "none",
    screen: true,
  });

  // A step the learner moves to takes the focus, but the first one keeps it where the browser put it.
  useEffect(() => {
    if (opened.current || open) {
      opened.current = true;
      focusStepTitle(stepRef.current);
    }
  }, [open, stepRef]);

  return { close: () => setOpen(false), exists, open: exists && open, show: () => setOpen(true) };
}

/**
 * The summary's buttons: Back on the rewards step, "See mistakes" (and "Keep going" right after
 * stopping) beside the main action, Continue to the rewards on a phone or Finish. Right after
 * stopping, "See mistakes" and "Keep going" share a phone's row and Finish takes its own under
 * them: all three in one row squeezed Finish's label ("Concluir" read "ncluir").
 */
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

/**
 * The end of the session on one screen: the day done with its four numbers, the skills that rose
 * and tomorrow's lesson, with "See mistakes" beside Finish, a link back to Today. From `lg` what
 * the day earned sits in the aside beside it; a phone gives it a step of its own (Continue) only
 * when there's more than the Brain Power the numbers show. Right after "Stop for today", what's
 * done so far, with Keep going beside Finish. The session's one milestone (a belt, the buddy
 * growing, glasses) opens over it first, as its own full-screen moment. A session with a block
 * still waiting that the learner didn't stop (the host read the day before "10 more minutes" added
 * it) goes straight on to that block.
 */
export function SummarySteps() {
  const t = useExtracted();
  const stopped = useIsStopped();
  const { actions, ceremony, exitHref, summary } = useSessionSummary();
  const stepRef = useRef<HTMLDivElement>(null);
  const rewards = useRewardsStep(stepRef);
  const keepGoing = useKeepGoing();
  const [momentShown, setMomentShown] = useState(false);

  // Once the milestone's moment is gone, the summary's title takes the focus, so the summary reads
  // on from there.
  useEffect(() => {
    if (momentShown) {
      focusStepTitle(stepRef.current);
    }
  }, [momentShown]);

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
    <TaskFrame
      aside={{ children: <EarnedToday />, label: t("Earned today"), title: t("Earned today") }}
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
        {rewards.open ? <RewardsStep /> : <DoneStep />}
      </div>

      {ceremony && milestone && !momentShown && ceremony(milestone, () => setMomentShown(true))}
    </TaskFrame>
  );
}
