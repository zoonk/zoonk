"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { PlayerContentFrame } from "../../components/step-layouts";
import { HyperdriveBadge } from "../_components/hyperdrive-badge";
import { MIN_SHOWN_HYPERDRIVE, getLessonTopHyperdrive } from "../_utils/lesson-hyperdrive";
import { describeReviewDate } from "../_utils/review-date";
import {
  type LessonCompletionSlotProps,
  useLessonPlayer,
  useLessonPlayerConfig,
} from "../lesson-player-context";
import { type LibraryLessonCompletion, type StudyBlockCompletion } from "../lesson-player-types";

function ReviewLine({ reviewAt }: { reviewAt: string }) {
  const t = useExtracted();
  const locale = useLocale();
  const when = describeReviewDate({ locale, reviewAt });

  const text =
    when.kind === "today" || when.kind === "tomorrow"
      ? t("We'll review this {when, select, today {later today} other {tomorrow}}", {
          when: when.kind,
        })
      : t("We'll review this on {day}", { day: when.label });

  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm">
      <LineMarker>
        <CalendarClockIcon aria-hidden="true" className="size-4" />
      </LineMarker>
      {text}
    </p>
  );
}

function SessionLine({ studyBlock }: { studyBlock: StudyBlockCompletion }) {
  const t = useExtracted();

  if (studyBlock.sessionCompleted) {
    return <p className="text-muted-foreground text-sm">{t("That's today's session done")}</p>;
  }

  return (
    <p className="text-muted-foreground text-sm">
      {t("{completed} of {total} done today", {
        completed: String(studyBlock.sessionBar.completed),
        total: String(studyBlock.sessionBar.total),
      })}
    </p>
  );
}

/** When the lesson comes back: its capsule's day in a session, or its skills' next review. */
function getComesBackAt(result: LibraryLessonCompletion): string | null {
  if (result.studyBlock?.comesBackOn) {
    // A learner-local day: read at local noon, so no time zone moves it to another day.
    return `${result.studyBlock.comesBackOn}T12:00:00`;
  }

  return result.nextReviewAt;
}

function BrainPowerTile({
  completion,
  onRetry,
  topHyperdrive,
}: Pick<LessonCompletionSlotProps, "completion" | "onRetry"> & { topHyperdrive: number }) {
  const t = useExtracted();
  const { skin } = useLessonPlayerConfig();

  if (completion.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-sm">{t("We couldn't save your progress yet.")}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if (!completion.result) {
    return <Skeleton className="h-16 w-32 rounded-2xl" />;
  }

  const points = completion.result.studyBlock?.brainPower ?? completion.result.brainPower;
  const showsHyperdrive = skin.showsHyperdrive && topHyperdrive >= MIN_SHOWN_HYPERDRIVE;

  // A lesson played again earns nothing new; "+0" would only read as a loss.
  if (points === 0 && !showsHyperdrive) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {points > 0 && (
        <div className="bg-muted/60 in-data-[mode=fun]:fun-glass flex w-fit flex-col rounded-2xl px-4 py-3">
          <span className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold tabular-nums">
            {t("+{points}", { points: String(points) })}
          </span>
          <span className="text-muted-foreground text-xs">{t("Brain Power")}</span>
        </div>
      )}

      {showsHyperdrive && (
        <div className="flex flex-col items-start gap-1">
          <HyperdriveBadge level={topHyperdrive} />
          <span className="text-muted-foreground text-xs">{t("Top Hyperdrive")}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The quick moment at the end of a lesson: a check, what was earned and when the idea comes back,
 * then one tap to keep going. The session's bigger summary waits for the end of the session.
 */
export function LessonCompletionMoment(props: LessonCompletionSlotProps) {
  const { completion, correctCount, incorrectCount, onRestart, onRetry } = props;
  const t = useExtracted();
  const { lesson, linkComponent: LinkComponent, routes, skin, slots } = useLessonPlayerConfig();
  const { state } = useLessonPlayer();
  const answered = correctCount + incorrectCount;
  const comesBackAt = completion.result ? getComesBackAt(completion.result) : null;

  const topHyperdrive =
    completion.result?.studyBlock?.topHyperdrive ?? getLessonTopHyperdrive(state);

  // Fun's buddy cheers the finished lesson in place of the check mark.
  const companion = slots.companion?.({
    isComplete: true,
    position: state.position,
    result: { isCorrect: true },
    rightInARow: 0,
  });

  return (
    <PlayerContentFrame className="my-auto flex flex-col gap-6 py-8" data-slot="lesson-completion">
      {companion ?? (
        <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-full">
          <CheckIcon aria-hidden="true" className="size-7" />
        </span>
      )}

      <div className="flex flex-col gap-1" role="status">
        <h2
          className="in-data-[mode=fun]:font-fun-display text-3xl font-semibold tracking-tight"
          data-slot="lesson-result-verdict"
        >
          {completion.testedOut ? t("You already knew this") : t("Lesson complete")}
        </h2>
        {answered > 0 && (
          <p className="text-muted-foreground">
            {t("{correct} of {answered} right the first time", {
              answered: String(answered),
              correct: String(correctCount),
            })}
          </p>
        )}
      </div>

      <BrainPowerTile completion={completion} onRetry={onRetry} topHyperdrive={topHyperdrive} />
      {comesBackAt && <ReviewLine reviewAt={comesBackAt} />}
      {completion.result?.studyBlock && <SessionLine studyBlock={completion.result.studyBlock} />}

      {slots.completionActions?.(props) ?? (
        <div className="flex flex-col gap-2">
          <LinkComponent
            aria-keyshortcuts="Enter"
            className={cn(
              buttonVariants({ size: "lg", variant: skin.primaryVariant }),
              "h-12 rounded-full text-base",
            )}
            href={routes.exit}
          >
            {t("Continue")}
            <ShortcutKbd tone={skin.primaryVariant === "default" ? "inverse" : "default"}>
              Enter
            </ShortcutKbd>
          </LinkComponent>

          <Button className="self-center" onClick={onRestart} size="sm" variant="ghost">
            <RotateCcwIcon aria-hidden="true" />
            {t("Start over")}
          </Button>
        </div>
      )}

      {slots.completionFeedback?.({ contentId: lesson.id, contentKind: "lesson" })}
    </PlayerContentFrame>
  );
}
