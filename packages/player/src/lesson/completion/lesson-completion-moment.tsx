"use client";

import { EnterLink } from "@zoonk/learn/enter-button";
import { MomentReadouts } from "@zoonk/learn/moment-readouts";
import { DayMoment } from "@zoonk/learn/session/day-moment";
import { FailedMoment } from "@zoonk/learn/session/failed-moment";
import { getLessonCelebration } from "@zoonk/learn/session/lesson-celebration";
import {
  MomentHeader,
  MomentSavingTitle,
  PendingMainAction,
} from "@zoonk/learn/session/moment-header";
import { pickDayMoment } from "@zoonk/learn/session/pick-day-moment";
import {
  TASK_WRAPPING_ACTION_CLASS,
  TaskActionBar,
  TaskActionLabel,
  TaskActions,
  TaskBody,
} from "@zoonk/learn/task-layout";
import { useStudyTimeFact } from "@zoonk/learn/time-format";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import {
  type LessonCompletionSlotProps,
  useLessonPlayer,
  useLessonPlayerConfig,
} from "../lesson-player-context";
import { LessonCompletionPlan, SeePlanAction } from "./lesson-completion-plan";

function CompletionReadouts({
  answered,
  brainPower,
  correct,
  seconds,
}: {
  answered: number;
  brainPower: number;
  correct: number;
  seconds: number;
}) {
  const studied = useStudyTimeFact(seconds);

  return <MomentReadouts brainPower={brainPower} facts={[studied]} score={{ answered, correct }} />;
}

function BackLabel({ exitTo }: { exitTo: "chapter" | "unit" | null }) {
  const t = useExtracted();

  return (
    <TaskActionLabel>
      {exitTo === "unit" ? t("Back to unit") : t("Back to chapter")}
    </TaskActionLabel>
  );
}

function NextLabel({ nextLesson }: { nextLesson: boolean }) {
  const t = useExtracted();
  return <TaskActionLabel>{nextLesson ? t("Next lesson") : t("Continue")}</TaskActionLabel>;
}

function CompletionLinks({ pending }: { pending: boolean }) {
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();
  const { state } = useLessonPlayer();
  const replay = state.run.status === "started" && state.run.replay;
  const nextLessonHref = replay ? null : routes.nextLesson;
  const nextLesson = Boolean(nextLessonHref);

  return (
    <TaskActionBar>
      <TaskActions>
        {nextLessonHref && (
          <LinkComponent
            className={cn(
              buttonVariants({ size: "xl", variant: "outline" }),
              TASK_WRAPPING_ACTION_CLASS,
            )}
            href={routes.exit}
          >
            <BackLabel exitTo={routes.exitTo} />
          </LinkComponent>
        )}

        {pending ? (
          <PendingMainAction>
            <NextLabel nextLesson={nextLesson} />
          </PendingMainAction>
        ) : (
          <EnterLink href={nextLessonHref ?? routes.exit} link={LinkComponent}>
            <NextLabel nextLesson={nextLesson} />
          </EnterLink>
        )}
      </TaskActions>
    </TaskActionBar>
  );
}

function SavedReadouts({ completion, correctCount, incorrectCount }: LessonCompletionSlotProps) {
  const { result } = completion;
  const celebration = result ? getLessonCelebration(result) : null;

  return (
    <CompletionReadouts
      answered={correctCount + incorrectCount}
      brainPower={celebration?.brainPower ?? 0}
      correct={correctCount}
      seconds={result?.seconds ?? 0}
    />
  );
}

/** The lesson end's actions: the plan's reveal, a host's own, or the way to the next lesson. */
function CompletionBar({
  planReveal,
  ...props
}: LessonCompletionSlotProps & {
  planReveal: ComponentProps<typeof SeePlanAction>["reveal"] | null;
}) {
  const { slots } = useLessonPlayerConfig();
  const isSaved = props.completion.status === "saved";

  if (planReveal) {
    return <SeePlanAction reveal={planReveal} />;
  }

  if (slots.completionActions) {
    return isSaved && slots.completionActions(props);
  }

  return <CompletionLinks pending={!isSaved} />;
}

/** A lesson's end shows one extra moment at most; the host draws a finished chapter's. */
function ExtraMoment({
  result,
}: {
  result: NonNullable<LessonCompletionSlotProps["completion"]["result"]>;
}) {
  const { buddy, slots } = useLessonPlayerConfig();
  const celebration = getLessonCelebration(result);
  const { finishedChapter } = result;

  if (
    slots.finishedChapter &&
    finishedChapter &&
    pickDayMoment({ ...celebration, finishedChapter }) === "chapter"
  ) {
    return slots.finishedChapter(finishedChapter);
  }

  return (
    <DayMoment
      buddy={buddy}
      ceremony={celebration.ceremony}
      missionMoment={celebration.missionMoment}
      reached={celebration.reached}
    />
  );
}

export function LessonCompletionMoment(props: LessonCompletionSlotProps) {
  const { completion, onRetry } = props;
  const t = useExtracted();
  const { slots } = useLessonPlayerConfig();
  const { result } = completion;
  const isSaved = completion.status === "saved";
  const planReveal = isSaved ? (result?.planReveal ?? null) : null;
  const title = completion.testedOut ? t("You already knew this") : t("Lesson complete");

  if (completion.status === "failed") {
    return <FailedMoment failures={completion.failures} onRetry={onRetry} />;
  }

  return (
    <>
      <TaskBody data-slot="lesson-completion">
        <MomentHeader title={isSaved ? title : <MomentSavingTitle />}>
          {isSaved && <SavedReadouts {...props} />}
        </MomentHeader>

        {isSaved && result && <ExtraMoment result={result} />}
        {planReveal && <LessonCompletionPlan reveal={planReveal} />}
        {isSaved && slots.completionDetails?.(props)}
      </TaskBody>

      <CompletionBar {...props} planReveal={planReveal} />
    </>
  );
}
