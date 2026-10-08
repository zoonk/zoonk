"use client";

import { useExtracted } from "next-intl";
import { KindTile } from "../../_components/kind-tile";
import { StepCard, StepEyebrow, StepHeader, StepTitle } from "../../_components/step-card";
import { Steps, type StepsItem } from "../../_components/steps";
import { getRisenSkills } from "./risen-skills";
import { FinishButton, SummaryOptions } from "./summary-actions";
import { useIsStopped, useSessionSummary } from "./summary-context";
import { ChangeStep, DoneStep, usePreparationChange } from "./summary-parts";
import { RewardsStep, hasRewards } from "./summary-rewards";

/** Tomorrow's lesson, so the day ends knowing what comes next. */
function TomorrowStep({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <StepCard>
      <KindTile kind="lesson" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Tomorrow")}</StepEyebrow>
        <StepTitle>{title}</StepTitle>
      </StepHeader>
    </StepCard>
  );
}

/** The summary's steps, each only when it has something to say. */
function useSummaryItems(): StepsItem[] {
  const stopped = useIsStopped();
  const { summary } = useSessionSummary();
  const change = usePreparationChange();
  const rises = getRisenSkills(summary.skillsMoved);

  // Stopped for today, the rest of the session waits: one step, what's done so far.
  if (stopped) {
    return [{ content: <DoneStep />, id: "done" }];
  }

  return [
    { content: <DoneStep />, id: "done" },
    (change || rises.length > 0) && { content: <ChangeStep />, id: "change" },
    hasRewards(summary) && { content: <RewardsStep />, id: "rewards" },
    summary.tomorrow && {
      content: <TomorrowStep title={summary.tomorrow.title} />,
      id: "tomorrow",
    },
  ].filter((item) => item !== null && item !== false);
}

/**
 * The session's one milestone (a belt, the buddy growing, glasses) as its own full-screen moment,
 * as the learner reaches the last step: after what the day earned, before what comes next.
 */
function useWithCeremony(items: StepsItem[]): StepsItem[] {
  const { ceremony, summary } = useSessionSummary();
  const milestone = summary.ceremony;
  const last = items.at(-1);

  if (!ceremony || !milestone || !last) {
    return items;
  }

  return [...items.slice(0, -1), { ...last, moment: (close) => ceremony(milestone, close) }];
}

/**
 * The end of the session, one thing at a time: the session done with its numbers, what changed
 * (the goal's number, the skills that rose), what it earned, then tomorrow with Finish. Right
 * after "Stop for today", one step: what's done so far, with Finish and Keep going.
 */
export function SummarySteps() {
  const { exitHref } = useSessionSummary();
  const items = useWithCeremony(useSummaryItems());

  return (
    <Steps
      exitHref={exitHref}
      finalAction={<FinishButton />}
      finalOptions={<SummaryOptions />}
      items={items}
    />
  );
}
