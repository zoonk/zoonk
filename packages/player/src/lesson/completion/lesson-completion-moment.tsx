"use client";

import { MomentReadouts } from "@zoonk/learn/moment-readouts";
import { DayMoment } from "@zoonk/learn/session/day-moment";
import { FailedMoment } from "@zoonk/learn/session/failed-moment";
import { getLessonCelebration } from "@zoonk/learn/session/lesson-celebration";
import { MomentHeader, MomentSaving, PendingMainAction } from "@zoonk/learn/session/moment-header";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActions,
  TaskBody,
} from "@zoonk/learn/task-layout";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { type LessonCompletionSlotProps, useLessonPlayerConfig } from "../lesson-player-context";

/**
 * The lesson's score and the Brain Power it earned as readouts, and when its idea comes back on the
 * quiet line under them, the way a session's moment says it. A lesson played again earns nothing
 * new: "+0" would only read as a loss.
 */
function CompletionReadouts({
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

  return (
    <MomentReadouts
      brainPower={brainPower}
      facts={[
        reviewAt &&
          t("Review on {date}", {
            date: format.dateTime(new Date(reviewAt), { day: "numeric", month: "short" }),
          }),
      ]}
      score={{ answered, correct }}
    />
  );
}

function BackLabel({ exitTo }: { exitTo: "chapter" | "unit" | null }) {
  const t = useExtracted();
  return exitTo === "unit" ? t("Back to unit") : t("Back to chapter");
}

function NextLabel({ nextLesson }: { nextLesson: boolean }) {
  const t = useExtracted();
  return nextLesson ? t("Next lesson") : t("Continue");
}

/**
 * Next lesson in the chapter as the main action, with the way back to it beside it, or one
 * Continue to where the lesson was opened, in the task's action bar. While the lesson saves
 * (`pending`), the main action is already in its place, waiting.
 */
function CompletionLinks({ pending }: { pending: boolean }) {
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();
  const primaryRef = useEnterClick<HTMLAnchorElement>();
  const nextLesson = Boolean(routes.nextLesson);

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

        {pending ? (
          <PendingMainAction>
            <NextLabel nextLesson={nextLesson} />
          </PendingMainAction>
        ) : (
          <LinkComponent
            aria-keyshortcuts="Enter"
            className={cn(buttonVariants({ size: "xl" }), TASK_MAIN_ACTION_CLASS)}
            href={routes.nextLesson ?? routes.exit}
            ref={primaryRef}
          >
            <NextLabel nextLesson={nextLesson} />
            <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
          </LinkComponent>
        )}
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * The quick moment at the end of a lesson, at the top of the task's column like any other screen,
 * the same as a session block's: the title, the score and the Brain Power earned as readouts with
 * when the idea comes back under them, the belt level and the tenth of Energy it reached, then the
 * way on in the action bar at the bottom. A host's own next steps (a guest's) sit under them. The
 * session's bigger summary waits for the end of the session.
 */
export function LessonCompletionMoment(props: LessonCompletionSlotProps) {
  const { completion, correctCount, incorrectCount, onRetry } = props;
  const t = useExtracted();
  const { buddy, slots } = useLessonPlayerConfig();
  const { result } = completion;
  const celebration = result ? getLessonCelebration(result) : null;
  const isSaved = completion.status === "saved";
  const title = completion.testedOut ? t("You already knew this") : t("Lesson complete");

  if (completion.status === "failed") {
    return <FailedMoment onRetry={onRetry} title={title} />;
  }

  return (
    <>
      <TaskBody data-slot="lesson-completion">
        <MomentHeader title={title}>
          {completion.status === "saving" && <MomentSaving />}

          {isSaved && (
            <CompletionReadouts
              answered={correctCount + incorrectCount}
              brainPower={celebration?.brainPower ?? 0}
              correct={correctCount}
              reviewAt={result?.nextReviewAt ?? null}
            />
          )}
        </MomentHeader>

        {isSaved && celebration && (
          <DayMoment
            buddy={buddy}
            ceremony={celebration.ceremony}
            missionMoment={celebration.missionMoment}
            reached={celebration.reached}
          />
        )}

        {isSaved && slots.completionActions?.(props)}
      </TaskBody>

      {!slots.completionActions && <CompletionLinks pending={!isSaved} />}
    </>
  );
}
