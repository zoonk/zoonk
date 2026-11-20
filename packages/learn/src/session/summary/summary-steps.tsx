"use client";

import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { focusStepTitle } from "../../_components/steps";
import { TaskHeaderTitle } from "../../_components/task-header";
import { TaskActions } from "../../_components/task-layout";
import { isFocusLost } from "../../_utils/is-focus-lost";
import { TaskFrame } from "../../shell/task-frame";
import { NextStepFailed } from "../action-failed";
import { MomentAfterCeremony } from "../moment-ceremony";
import { OpenNextStep } from "../open-next-step";
import { SessionHeader } from "../session-header";
import {
  FinishLink,
  KeepGoingButton,
  SHARED_ROW_ACTION_CLASS,
  SeeMistakesLink,
  SummaryOptions,
  useKeepGoing,
} from "./summary-actions";
import { useIsStopped, useSessionSummary } from "./summary-context";
import { DoneStep } from "./summary-parts";
import { EarnedToday } from "./summary-rewards";

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

export function SummarySteps() {
  const t = useExtracted();
  const { actions, ceremony, exitHref, stopped, summary } = useSessionSummary();

  if (!stopped && !summary.finished) {
    return (
      <OpenNextStep
        exitHref={exitHref}
        header={<SessionHeader exitHref={exitHref} />}
        openNextStep={async () => {
          actions.refresh();
          return true;
        }}
        status={t("Getting it ready…")}
      />
    );
  }

  return (
    <MomentAfterCeremony moments={summary} render={ceremony}>
      <SummaryVisit />
    </MomentAfterCeremony>
  );
}

function SummaryVisit() {
  const t = useExtracted();
  const { actions, exitHref } = useSessionSummary();
  const visitId = useRef<string | null>(null);
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);

  if (firstVisit !== null) {
    return <DailySummary firstVisit={firstVisit} />;
  }

  return (
    <OpenNextStep
      exitHref={exitHref}
      header={<SessionHeader exitHref={exitHref} />}
      openNextStep={async () => {
        visitId.current ??= crypto.randomUUID();
        const result = await actions.visit(visitId.current);

        if (result === null) {
          return false;
        }

        if (result !== "left") {
          setFirstVisit(result);
        }

        return true;
      }}
      status={t("Getting it ready…")}
    />
  );
}

function DailySummary({ firstVisit }: { firstVisit: boolean }) {
  const t = useExtracted();
  const { exitHref } = useSessionSummary();
  const stepRef = useRef<HTMLDivElement>(null);
  const keepGoing = useKeepGoing();

  useEffect(() => {
    if (isFocusLost(document.activeElement)) {
      focusStepTitle(stepRef.current);
    }
  }, []);

  return (
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
      exitHref={exitHref}
      footer={
        <>
          <SummaryButtons keepGoing={keepGoing} />
          <SummaryOptions />
        </>
      }
      footerNote={keepGoing.failed && <NextStepFailed />}
      headerTitle={<TaskHeaderTitle title={t("Today")} />}
    >
      <CelebrationScope play={firstVisit}>
        <div className="flex flex-col gap-4" data-slot="steps-step" ref={stepRef}>
          <DoneStep />
        </div>
      </CelebrationScope>
    </TaskFrame>
  );
}
