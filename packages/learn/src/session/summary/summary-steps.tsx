"use client";

import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { focusStepTitle } from "../../_components/steps";
import { TaskHeaderTitle } from "../../_components/task-header";
import { TaskActions } from "../../_components/task-layout";
import { isFocusLost } from "../../_utils/is-focus-lost";
import { TaskFrame } from "../../shell/task-frame";
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
import { EarnedToday } from "./summary-rewards";
import { useFirstSummaryVisit } from "./use-first-summary-visit";

function SummaryButtons({ keepGoing }: { keepGoing: ReturnType<typeof useKeepGoing> }) {
  const stopped = useIsStopped();
  const { mistakesHref, summary } = useSessionSummary();
  const canSeeMistakes = mistakesHref !== null && summary.mistakesSaved > 0;
  const crowded = stopped && canSeeMistakes;
  const sharedRow = crowded ? SHARED_ROW_ACTION_CLASS : undefined;

  return (
    <TaskActions>
      {canSeeMistakes && <SeeMistakesLink className={sharedRow} href={mistakesHref} />}
      {stopped && <KeepGoingButton className={sharedRow} keepGoing={keepGoing} />}
      <FinishLink className={crowded ? "max-lg:basis-full" : undefined} />
    </TaskActions>
  );
}

/** One screen: the day's numbers, what it earned, tomorrow, and Finish. */
export function SummarySteps() {
  const t = useExtracted();
  const stopped = useIsStopped();
  const { actions, ceremony, exitHref, summary } = useSessionSummary();
  const stepRef = useRef<HTMLDivElement>(null);
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

  return (
    <MomentAfterCeremony moments={summary} render={ceremony}>
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
            <SummaryButtons keepGoing={keepGoing} />
            <SummaryOptions />
          </>
        }
        headerTitle={<TaskHeaderTitle title={t("Today")} />}
      >
        <CelebrationScope play={firstVisit}>
          <div className="flex flex-col gap-4" data-slot="steps-step" ref={stepRef}>
            <DoneStep />
          </div>
        </CelebrationScope>
      </TaskFrame>
    </MomentAfterCeremony>
  );
}
