"use client";

import { FactChip, FactChips } from "@zoonk/learn/fact-chips";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, CheckIcon, TargetIcon, ZapIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { PlayerContentFrame } from "../../components/step-layouts";
import { describeReviewDate } from "../_utils/review-date";
import { type LessonCompletionSlotProps, useLessonPlayerConfig } from "../lesson-player-context";

const PRIMARY_LINK = cn(buttonVariants({ size: "lg" }), "h-12 w-full rounded-full text-base");

const SECONDARY_LINK = cn(
  buttonVariants({ size: "lg", variant: "outline" }),
  "h-12 w-full rounded-full text-base",
);

function ReviewChip({ reviewAt }: { reviewAt: string }) {
  const t = useExtracted();
  const locale = useLocale();
  const when = describeReviewDate({ locale, reviewAt });

  return (
    <FactChip>
      <CalendarClockIcon aria-hidden="true" />
      {t(
        "This idea comes back {when, select, today {in a review later today} tomorrow {in tomorrow's review} weekday {in {day}'s review} other {in a review on {day}}}",
        { day: "label" in when ? when.label : "", when: when.kind },
      )}
    </FactChip>
  );
}

/**
 * The lesson's score and what it earned, as chips ("3 of 5 right", "+22 Brain Power"), and when
 * its idea comes back. A lesson played again earns nothing new; "+0" would only read as a loss.
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

  if (answered === 0 && brainPower === 0 && !reviewAt) {
    return null;
  }

  return (
    <FactChips className="justify-center">
      {answered > 0 && (
        <FactChip>
          <TargetIcon aria-hidden="true" />
          {t("{correct} of {answered} right", {
            answered: String(answered),
            correct: String(correct),
          })}
        </FactChip>
      )}
      {brainPower > 0 && (
        <FactChip>
          <ZapIcon aria-hidden="true" />
          {t("+{points} Brain Power", { points: String(brainPower) })}
        </FactChip>
      )}
      {reviewAt && <ReviewChip reviewAt={reviewAt} />}
    </FactChips>
  );
}

function BackLabel({ exitTo }: { exitTo: "chapter" | "unit" | null }) {
  const t = useExtracted();
  return exitTo === "unit" ? t("Back to unit") : t("Back to chapter");
}

/** Next lesson in the chapter (with a way back to it), or one Continue to where it was opened. */
function CompletionLinks() {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();
  const primaryRef = useEnterClick<HTMLAnchorElement>();

  return (
    <div className="flex flex-col gap-2">
      <LinkComponent
        aria-keyshortcuts="Enter"
        className={PRIMARY_LINK}
        href={routes.nextLesson ?? routes.exit}
        ref={primaryRef}
      >
        {routes.nextLesson ? t("Next lesson") : t("Continue")}
        <ShortcutKbd tone="inverse">Enter</ShortcutKbd>
      </LinkComponent>

      {routes.nextLesson && (
        <LinkComponent className={SECONDARY_LINK} href={routes.exit}>
          <BackLabel exitTo={routes.exitTo} />
        </LinkComponent>
      )}
    </div>
  );
}

/**
 * The quick moment at the end of a lesson: a check that pops in, the score and what it earned as
 * chips with when the idea comes back, then one tap to keep going. On phones the way on sits at the
 * bottom; on wide screens the moment and its actions stay together in the middle. The session's
 * bigger summary waits for the end of the session.
 */
export function LessonCompletionMoment(props: LessonCompletionSlotProps) {
  const { completion, correctCount, incorrectCount, onRetry } = props;
  const t = useExtracted();
  const { slots } = useLessonPlayerConfig();
  const { result } = completion;
  const brainPower = result ? (result.studyBlock?.brainPower ?? result.brainPower) : 0;

  return (
    <PlayerContentFrame
      className="flex max-w-xl flex-1 flex-col py-6 lg:justify-center-safe"
      data-slot="lesson-completion"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center lg:flex-none">
        <span className="bg-success/10 text-success animate-in zoom-in-50 fade-in flex size-20 items-center justify-center rounded-full duration-500 ease-out motion-reduce:animate-none">
          <CheckIcon aria-hidden="true" className="size-10" strokeWidth={2.5} />
        </span>

        <div className="flex flex-col items-center gap-4" role="status">
          <h2
            className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            data-slot="lesson-result-verdict"
          >
            {completion.testedOut ? t("You already knew this") : t("Lesson complete")}
          </h2>

          {completion.status === "saving" && <Skeleton className="h-8 w-48 rounded-full" />}

          {completion.status === "saved" && (
            <CompletionFacts
              answered={correctCount + incorrectCount}
              brainPower={brainPower}
              correct={correctCount}
              reviewAt={result?.nextReviewAt ?? null}
            />
          )}
        </div>

        {completion.status === "failed" && (
          <div className="flex flex-col items-center gap-2" role="alert">
            <p className="text-sm">{t("We couldn't save your progress yet.")}</p>
            <Button onClick={onRetry} variant="outline">
              {t("Try again")}
            </Button>
          </div>
        )}
      </div>

      {completion.status === "saved" && (
        <div className="flex flex-col pt-8">
          {slots.completionActions?.(props) ?? <CompletionLinks />}
        </div>
      )}
    </PlayerContentFrame>
  );
}
