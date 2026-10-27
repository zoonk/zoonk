"use client";

import { type Reached } from "@zoonk/core/sessions/reached";
import { useExtracted } from "next-intl";
import { MomentReadouts } from "../_components/moment-readouts";
import { StepCard, StepDetail, StepHeader } from "../_components/step-card";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { DayMoment } from "../session/day-moment";
import { MomentAfterCeremony, type MomentCeremony } from "../session/moment-ceremony";
import { MomentHeader } from "../session/moment-header";
import { PendingMoment } from "../session/pending-moment";
import { TaskMainLink } from "../shell/task-frame";
import { type MistakePracticeSummary } from "./mistake-practice-state";

/**
 * The one way out, pinned at the bottom like every task's main action (or Enter), in the bar's
 * row: full width on a phone, as wide as its label from `lg`.
 */
function BackBar({ backHref }: { backHref: string }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainLink href={backHref}>{t("Back")}</TaskMainLink>
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * What the run did, as every task's end says it: its right answers and the Brain Power it earned
 * as readouts (never "+0"), and the mistakes it fixed on the quiet line under them.
 */
function PracticeEarned({
  fixed,
  summary,
}: {
  fixed: number;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();

  return (
    <MomentReadouts
      brainPower={summary?.brainPower ?? 0}
      facts={[
        fixed > 0 &&
          t("{count, plural, one {# mistake fixed} other {# mistakes fixed}}", { count: fixed }),
      ]}
      score={summary && { answered: summary.total, correct: summary.correct }}
    />
  );
}

/** Nothing is due for practice yet: mistakes come back from the day after they're made. */
export function NothingToPractice({ backHref }: { backHref: string }) {
  const t = useExtracted();

  return (
    <>
      <TaskBody>
        <StepCard role="status">
          <StepHeader>
            <h2 className="text-title">{t("Nothing to practice yet")}</h2>
            <StepDetail>
              {t("Mistakes come back for practice from the day after you make them.")}
            </StepDetail>
          </StepHeader>
        </StepCard>
      </TaskBody>

      <BackBar backHref={backHref} />
    </>
  );
}

/**
 * The end of a run, at the last question or stopped early, straight on the page under the run's
 * header, as every task's end reads: "Practice done", what it earned (right answers, Brain Power,
 * the mistakes it fixed), what it did to the day (its missions, the level and the tenth of Energy
 * the whole run reached), each part 24px from the next, and back to the notebook from the pinned
 * bar. A run with a miss, or one that counted nothing, says the rest come back, so a hard day
 * reads as "not yet". A milestone it earned opens first, on its own.
 */
export function PracticeDone({
  backHref,
  buddy,
  fixed,
  reached,
  renderCeremony,
  summary,
}: {
  backHref: string;
  /** The learner's buddy, who cheers when the run completes one of the day's missions. */
  buddy?: LearnBuddy | null;
  fixed: number;
  /** What every count of the run reached, its end's included. */
  reached: Reached;
  renderCeremony?: MomentCeremony;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();
  const ceremony = summary?.ceremony ?? null;
  const comesBack = summary ? summary.correct < summary.total : fixed === 0;

  return (
    <MomentAfterCeremony milestone={ceremony} render={renderCeremony}>
      <TaskBody>
        <MomentHeader
          detail={comesBack && t("The rest come back another day, when they stick better.")}
          title={t("Practice done")}
        >
          <PracticeEarned fixed={fixed} summary={summary} />
        </MomentHeader>

        <DayMoment
          buddy={buddy}
          ceremony={ceremony}
          missionMoment={summary?.missionMoment ?? null}
          reached={reached}
        />
      </TaskBody>

      <BackBar backHref={backHref} />
    </MomentAfterCeremony>
  );
}

/** The run's answers being counted toward today: its end, already titled, waiting for them. */
export function PracticeSaving() {
  const t = useExtracted();

  return <PendingMoment action={t("Back")} title={t("Practice done")} />;
}
