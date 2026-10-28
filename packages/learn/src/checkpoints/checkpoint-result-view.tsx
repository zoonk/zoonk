"use client";

import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { useExtracted } from "next-intl";
import { MomentReadouts } from "../_components/moment-readouts";
import { StepCard, StepHeader, StepTitle } from "../_components/step-card";
import { Steps } from "../_components/steps";
import { useTaskAsideShown } from "../_components/task-header";
import { SCREEN_STEADY_MS } from "../_utils/use-steady";
import { DayMoment } from "../session/day-moment";
import { getCeremonyMoment } from "../session/moment-ceremony";
import { TaskMainLink } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";
import { NoVerdictStep } from "./checkpoint-empty";
import { useCheckpointEyebrow } from "./checkpoint-labels";
import { CheckpointResultDetails } from "./checkpoint-result-details";
import {
  CheckpointReviewDrawer,
  CheckpointReviewSection,
  useReviewedAnswers,
} from "./checkpoint-review";
import { TricksterArt } from "./trickster-art";
import { useCheckpointOutcome, useIsWon } from "./use-checkpoint-outcome";

function useHeadline(): string {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const won = useIsWon();

  if (checkpoint.kind === "weekly") {
    return t("Weekly challenge done");
  }

  return won ? t("You beat the Trickster!") : t("Not this time");
}

function ScoreLine() {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const outcome = useCheckpointOutcome();
  const won = useIsWon();

  if (!outcome) {
    return null;
  }

  return (
    <MomentReadouts
      brainPower={0}
      className="pt-3"
      facts={[
        !won &&
          duel.state.completion?.checkpoint &&
          t("{count, plural, one {# of {total} right to win} other {# of {total} right to win}}", {
            count: duel.state.completion.checkpoint.passMark,
            total: String(checkpoint.questions.length),
          }),
      ]}
      score={{ answered: outcome.total, correct: outcome.correct }}
    />
  );
}

function ResultArt() {
  const { checkpoint, duel } = useCheckpointScreen();
  const won = useIsWon();

  if (checkpoint.kind === "weekly") {
    return null;
  }

  return (
    <CelebrationScope play={duel.state.completion !== null}>
      <TricksterArt beaten={won} reacts />
    </CelebrationScope>
  );
}

function DuelDayMoment() {
  const { buddy, duel } = useCheckpointScreen();
  const completion = duel.state.completion;

  if (!completion) {
    return null;
  }

  return (
    <DayMoment
      buddy={buddy}
      ceremony={completion.ceremony}
      missionMoment={{
        completed: completion.completedMissions,
        fullMeal: completion.fullMeal,
        missions: completion.missions,
      }}
      reached={completion.reached}
    />
  );
}

function OutcomeStep({ showsReview }: { showsReview: boolean }) {
  const headline = useHeadline();

  return (
    <StepCard className="gap-6">
      <ResultArt />

      <StepHeader>
        <StepTitle>{headline}</StepTitle>
        <ScoreLine />
      </StepHeader>

      <DuelDayMoment />

      <div className="flex w-full flex-col gap-6 lg:hidden">
        <CheckpointResultDetails />
      </div>

      {showsReview && <CheckpointReviewSection />}
    </StepCard>
  );
}

export function CheckpointResultView() {
  const t = useExtracted();
  const { checkpoint, duel, hrefs, renderCeremony } = useCheckpointScreen();
  const ceremony = duel.state.completion?.ceremony ?? null;
  const name = useCheckpointEyebrow(checkpoint);
  const outcome = useCheckpointOutcome();
  const reviewed = useReviewedAnswers();
  // The answers sit beside the outcome where the aside shows, and in a sheet on a phone. Only a
  // duel just finished has them, so this never changes what the server drew.
  const docked = useTaskAsideShown();
  const hasReview = reviewed.length > 0;

  return (
    <Steps
      aside={outcome ? { children: <CheckpointResultDetails />, label: name, title: name } : null}
      exitHref={hrefs.exit}
      finalAction={
        <TaskMainLink href={hrefs.continue} steadyMs={SCREEN_STEADY_MS}>
          {t("Continue")}
        </TaskMainLink>
      }
      items={[
        {
          action: hasReview && !docked ? <CheckpointReviewDrawer /> : null,
          content: outcome ? <OutcomeStep showsReview={hasReview && docked} /> : <NoVerdictStep />,
          id: "outcome",
          moment: getCeremonyMoment({ milestone: ceremony, render: renderCeremony }),
        },
      ]}
    />
  );
}
