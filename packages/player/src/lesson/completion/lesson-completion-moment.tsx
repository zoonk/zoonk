"use client";

import { DayMoment } from "@zoonk/learn/session/day-moment";
import { getLessonCelebration } from "@zoonk/learn/session/lesson-celebration";
import { MOMENT_TITLE_PROPS } from "@zoonk/learn/session/moment-ceremony";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActions,
  TaskBody,
} from "@zoonk/learn/task-layout";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment } from "react";
import { type LessonCompletionSlotProps, useLessonPlayerConfig } from "../lesson-player-context";

/**
 * The lesson's score, what it earned and when its idea comes back, as one quiet mono line ("3 of 5
 * right · +22 Brain Power · Review on Oct 14"), the way a session's moment says it. A lesson played
 * again earns nothing new: "+0" would only read as a loss.
 */
function CompletionFacts({
  answered,
  brainPower,
  correct,
  reviewAt,
}: {
  answered: number;
  brainPower: number;
  correct: number;
  reviewAt: string | null;
}) {
  const t = useExtracted();
  const format = useFormatter();

  const facts = [
    answered > 0 &&
      t("{correct} of {answered} right", { answered: String(answered), correct: String(correct) }),
    reviewAt &&
      t("Review on {date}", {
        date: format.dateTime(new Date(reviewAt), { day: "numeric", month: "short" }),
      }),
  ].filter((fact): fact is string => Boolean(fact));

  // The reward comes last, in Brain Power's violet, as every reward amount reads.
  const reward =
    brainPower > 0 && t("+{points} Brain Power", { points: format.number(brainPower) });

  if (facts.length === 0 && !reward) {
    return null;
  }

  return (
    <p
      className="text-muted-foreground font-mono text-xs leading-5 tabular-nums"
      data-slot="lesson-completion-facts"
    >
      {facts.map((fact, index) => (
        <Fragment key={fact}>
          {index > 0 && " · "}
          <span>{fact}</span>
        </Fragment>
      ))}
      {reward && (
        <>
          {facts.length > 0 && " · "}
          <span className="text-brain-text">{reward}</span>
        </>
      )}
    </p>
  );
}

function BackLabel({ exitTo }: { exitTo: "chapter" | "unit" | null }) {
  const t = useExtracted();
  return exitTo === "unit" ? t("Back to unit") : t("Back to chapter");
}

/**
 * Next lesson in the chapter as the main action, with the way back to it beside it, or one
 * Continue to where the lesson was opened, in the task's action bar.
 */
function CompletionLinks() {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();
  const primaryRef = useEnterClick<HTMLAnchorElement>();

  return (
    <TaskActionBar>
      <TaskActions>
        {routes.nextLesson && (
          <LinkComponent
            className={buttonVariants({ size: "xl", variant: "outline" })}
            href={routes.exit}
          >
            <BackLabel exitTo={routes.exitTo} />
          </LinkComponent>
        )}

        <LinkComponent
          aria-keyshortcuts="Enter"
          className={cn(buttonVariants({ size: "xl" }), TASK_MAIN_ACTION_CLASS)}
          href={routes.nextLesson ?? routes.exit}
          ref={primaryRef}
        >
          {routes.nextLesson ? t("Next lesson") : t("Continue")}
          <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
        </LinkComponent>
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * The quick moment at the end of a lesson, at the top of the task's column like any other screen,
 * the same as a session block's: the title and one mono line with the score, what it earned and
 * when the idea comes back, the belt level and the tenth of Energy it reached, then the way on in
 * the action bar at the bottom. A host's own next steps (a guest's) sit under them. The session's
 * bigger summary waits for the end of the session.
 */
export function LessonCompletionMoment(props: LessonCompletionSlotProps) {
  const { completion, correctCount, incorrectCount, onRetry } = props;
  const t = useExtracted();
  const { buddy, slots } = useLessonPlayerConfig();
  const { result } = completion;
  const celebration = result ? getLessonCelebration(result) : null;
  const isSaved = completion.status === "saved";

  return (
    <>
      <TaskBody data-slot="lesson-completion">
        <div className="flex flex-col items-start gap-2" role="status">
          <h2 className="text-title outline-none" {...MOMENT_TITLE_PROPS}>
            {completion.testedOut ? t("You already knew this") : t("Lesson complete")}
          </h2>

          {completion.status === "saving" && <Skeleton className="h-5 w-56" />}

          {isSaved && (
            <CompletionFacts
              answered={correctCount + incorrectCount}
              brainPower={celebration?.brainPower ?? 0}
              correct={correctCount}
              reviewAt={result?.nextReviewAt ?? null}
            />
          )}
        </div>

        {isSaved && celebration && (
          <DayMoment
            buddy={buddy}
            ceremony={celebration.ceremony}
            missionMoment={celebration.missionMoment}
            reached={celebration.reached}
          />
        )}

        {completion.status === "failed" && (
          <div className="flex flex-col items-start gap-2" role="alert">
            <p className="text-sm">{t("We couldn't save your progress yet.")}</p>
            <Button onClick={onRetry} size="lg" variant="outline">
              {t("Try again")}
            </Button>
          </div>
        )}

        {isSaved && slots.completionActions?.(props)}
      </TaskBody>

      {isSaved && !slots.completionActions && <CompletionLinks />}
    </>
  );
}
