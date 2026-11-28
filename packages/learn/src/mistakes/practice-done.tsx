"use client";

import { type Reached } from "@zoonk/core/sessions/reached";
import { Button } from "@zoonk/ui/components/button";
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
import { TaskMainLink } from "../shell/task-frame";
import { type MistakePracticeSummary } from "./mistake-practice-state";

function EndBar({ href, label }: { href: string; label: string }) {
  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainLink href={href}>{label}</TaskMainLink>
      </TaskActions>
    </TaskActionBar>
  );
}

/** The score is the run's own answers: a same-day repeat batch earns nothing new but still scored. */
function PracticeEarned({
  fixed,
  score,
  summary,
}: {
  fixed: number;
  score: { answered: number; correct: number };
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
      score={score.answered > 0 ? score : null}
    />
  );
}

/** A day's block whose mistakes were fixed elsewhere: nothing went wrong, and the day goes on. */
export function NothingToPractice({ dayBlock, doneHref }: { dayBlock: boolean; doneHref: string }) {
  const t = useExtracted();

  return (
    <>
      <TaskBody>
        <StepCard role="status">
          <StepHeader>
            <h2 className="text-title">
              {dayBlock
                ? t({
                    description:
                      "Title when a day's practice of mistakes opens and every one of its mistakes was already fixed elsewhere.",
                    message: "Already fixed",
                  })
                : t("Nothing to practice")}
            </h2>
          </StepHeader>
        </StepCard>
      </TaskBody>

      <EndBar href={doneHref} label={dayBlock ? t("Done") : t("Back")} />
    </>
  );
}

export type PracticeAgain = { failed: boolean; loading: boolean; start: () => void };

/**
 * The way forward leads: Done back where the run came from, or Continue into a day's next stop.
 * Practicing again is the second action, only while it can still fix something today.
 */
function DoneBar({
  again,
  dayBlock,
  doneHref,
}: {
  again: PracticeAgain | null;
  dayBlock: boolean;
  doneHref: string;
}) {
  const t = useExtracted();

  return (
    <TaskActionBar note={again?.failed && <AnswersSaveError failures={1} />}>
      <TaskActions>
        {again && (
          <Button busy={again.loading} onClick={again.start} size="xl" variant="outline">
            {t({
              description:
                "Beside Done at the end of a practice of mistakes: starts another round right away.",
              message: "Practice again",
            })}
          </Button>
        )}

        <TaskMainLink href={doneHref}>{dayBlock ? t("Continue") : t("Done")}</TaskMainLink>
      </TaskActions>
    </TaskActionBar>
  );
}

export function PracticeDone({
  again,
  buddy,
  dayBlock,
  doneHref,
  fixed,
  reached,
  renderCeremony,
  score,
  summary,
}: {
  again: PracticeAgain | null;
  buddy?: LearnBuddy | null;
  dayBlock: boolean;
  doneHref: string;
  fixed: number;
  reached: Reached;
  renderCeremony?: MomentCeremony;
  score: { answered: number; correct: number };
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();
  const ceremony = summary?.ceremony ?? null;

  return (
    <MomentAfterCeremony moments={summary} render={renderCeremony}>
      <TaskBody>
        <MomentHeader title={t("Practice done")}>
          <PracticeEarned fixed={fixed} score={score} summary={summary} />
        </MomentHeader>

        <DayMoment
          buddy={buddy}
          ceremony={ceremony}
          missionMoment={summary?.missionMoment ?? null}
          reached={reached}
        />
      </TaskBody>

      <DoneBar again={again} dayBlock={dayBlock} doneHref={doneHref} />
    </MomentAfterCeremony>
  );
}

export function PracticeSaving() {
  const t = useExtracted();

  return <PendingMoment action={t("Back")} />;
}
