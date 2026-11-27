"use client";

import { type Reached } from "@zoonk/core/sessions/reached";
import { useExtracted } from "next-intl";
import { MomentReadouts } from "../_components/moment-readouts";
import { AnswersSaveError } from "../_components/save-error";
import { StepCard, StepHeader } from "../_components/step-card";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { DayMoment } from "../session/day-moment";
import { MomentAfterCeremony, type MomentCeremony } from "../session/moment-ceremony";
import { MomentHeader } from "../session/moment-header";
import { PendingMoment } from "../session/pending-moment";
import { TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { type MistakePracticeSummary } from "./mistake-practice-state";

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

export function NothingToPractice({ backHref }: { backHref: string }) {
  const t = useExtracted();

  return (
    <>
      <TaskBody>
        <StepCard role="status">
          <StepHeader>
            <h2 className="text-title">{t("Nothing to practice")}</h2>
          </StepHeader>
        </StepCard>
      </TaskBody>

      <BackBar backHref={backHref} />
    </>
  );
}

export type PracticeAgain = { failed: boolean; loading: boolean; start: () => void };

/** Practicing again loads a fresh batch; with nothing left, the learner is done. */
function DoneBar({ again, backHref }: { again: PracticeAgain | null; backHref: string }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      {again?.failed && <AnswersSaveError failures={1} />}
      <TaskActions>
        {again ? (
          <TaskMainButton busy={again.loading} onClick={again.start}>
            {t("Practice again")}
          </TaskMainButton>
        ) : (
          <TaskMainLink href={backHref}>{t("Done")}</TaskMainLink>
        )}
      </TaskActions>
    </TaskActionBar>
  );
}

export function PracticeDone({
  again,
  backHref,
  buddy,
  fixed,
  reached,
  renderCeremony,
  summary,
}: {
  again: PracticeAgain | null;
  backHref: string;
  buddy?: LearnBuddy | null;
  fixed: number;
  reached: Reached;
  renderCeremony?: MomentCeremony;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();
  const ceremony = summary?.ceremony ?? null;

  return (
    <MomentAfterCeremony moments={summary} render={renderCeremony}>
      <TaskBody>
        <MomentHeader title={t("Practice done")}>
          <PracticeEarned fixed={fixed} summary={summary} />
        </MomentHeader>

        <DayMoment
          buddy={buddy}
          ceremony={ceremony}
          missionMoment={summary?.missionMoment ?? null}
          reached={reached}
        />
      </TaskBody>

      <DoneBar again={again} backHref={backHref} />
    </MomentAfterCeremony>
  );
}

export function PracticeSaving() {
  const t = useExtracted();

  return <PendingMoment action={t("Back")} />;
}
