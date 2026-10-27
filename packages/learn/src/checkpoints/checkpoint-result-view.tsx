"use client";

import { useCelebration } from "@zoonk/ui/hooks/celebration";
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

/**
 * "5 of 6 right" as a readout, as every task's end draws its score; a duel not won also says what
 * winning took, of all its questions ("7 of 10 right to win"), since it ends as soon as it can't be
 * won: "2 of 6 right" alone would read as if 7 were never in reach. Its Brain Power is the rewards'
 * row, so the readouts leave it out.
 */
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
          t("{count} of {total} right to win", {
            count: String(duel.state.completion.checkpoint.passMark),
            total: String(checkpoint.questions.length),
          }),
      ]}
      score={{ answered: outcome.total, correct: outcome.correct }}
    />
  );
}

/**
 * The Trickster, beaten or not; the week's challenge has no art, its title says it all. Beaten in
 * the duel just played, he tips back into his pose on the spring; a result opened again later
 * shows him leaning back already.
 */
function ResultArt() {
  const { checkpoint, duel } = useCheckpointScreen();
  const won = useIsWon();
  const celebrate = useCelebration();
  const tips = won && celebrate && duel.state.completion !== null;

  if (checkpoint.kind === "weekly") {
    return null;
  }

  return <TricksterArt beaten={won} className={tips ? "animate-tip" : undefined} />;
}

/**
 * What the duel did to the day, right under its score, as every block's moment says it: the
 * missions it completed by name (the day's bonus when it was the last), then the belt level and
 * the tenth of Energy it reached.
 */
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

/**
 * How it went, on one page: the Trickster and the score, what it did to the day's missions and
 * level; on a phone, what it earned and what's next under them (a wide screen has those in the
 * aside); and, where the aside shows, the answers explained right under the outcome.
 */
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

/**
 * The end of a checkpoint, on one screen. A win: the Trickster beaten, the score, what it earned
 * and the next phase. A duel not won is kind and concrete: a new try after short lessons, and the
 * next phase already open. The answers and the traps are explained under the outcome where the
 * screen is wide (its aside then holds what it earned), and one tap away beside Continue on a
 * phone. One whose questions were removed before any answer has nothing to judge: one line says
 * so, without an aside, and Continue moves on.
 */
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
          // A milestone the duel earned (the Star glasses) opens right over its result.
          moment: getCeremonyMoment({ milestone: ceremony, render: renderCeremony }),
        },
      ]}
    />
  );
}
