"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
import { type NoSitting, type NoticeDay } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { CalendarDaysIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { useFormatIsoDate } from "../_utils/iso-date";

/**
 * "The exam notice says January 10, 2027.": the notice's day when the plan counts down to another,
 * said the same way wherever the date shows (or, while the edition's notice isn't out, its likely
 * day). A language certificate's comes from its official calendar (see `ExamDocument`).
 */
export function useNoticeDayText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return ({ date, document, estimated }: NoticeDay & { document: ExamDocument }): string =>
    estimated
      ? t("The exam's likely date is now {date}.", { date: formatDate(date, "long") })
      : t(
          "{document, select, notice {The exam notice says {date}.} other {The exam's official calendar says {date}.}}",
          { date: formatDate(date, "long"), document },
        );
}

/**
 * "Use this date": takes the notice's day as the goal's date with one tap. The caller saves it
 * (`onUse`) and says when that didn't work.
 */
export function UseDateButton({
  onUse,
  variant = "outline",
}: {
  onUse: () => Promise<unknown>;
  variant?: "outline" | "secondary";
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      focusableWhenDisabled
      onClick={() =>
        startTransition(async () => {
          await onUse();
        })
      }
      size="sm"
      type="button"
      variant={variant}
    >
      {t("Use this date")}
    </Button>
  );
}

function CalendarTile() {
  return (
    <NoticeCardLeading>
      <span className="bg-muted flex size-8 items-center justify-center rounded-lg">
        <CalendarDaysIcon className="size-4" />
      </span>
    </NoticeCardLeading>
  );
}

function FailedMessage() {
  const t = useExtracted();

  return (
    <p className="text-destructive mt-2 text-sm" role="alert">
      {t("That didn't work. Try again in a moment.")}
    </p>
  );
}

/**
 * The notice's day as a note with its one tap, where a page wants it read before the rest (the
 * plan's reveal, the exam's page). The learner's own date stays until they take it.
 */
function NoticeDayCard({
  day,
  document,
  onUse,
}: {
  day: NoticeDay;
  document: ExamDocument;
  onUse: () => Promise<boolean>;
}) {
  const text = useNoticeDayText();
  const [failed, setFailed] = useState(false);

  const use = async () => {
    setFailed(false);
    setFailed(!(await onUse()));
  };

  return (
    <NoticeCard data-slot="notice-day">
      <CalendarTile />

      <NoticeCardContent>
        <NoticeCardTitle>{text({ ...day, document })}</NoticeCardTitle>
        <NoticeCardActions>
          <UseDateButton onUse={use} variant="secondary" />
        </NoticeCardActions>

        {failed && <FailedMessage />}
      </NoticeCardContent>
    </NoticeCard>
  );
}

/**
 * An exam held several times a year with no sitting in the learner's month ("No exam date in
 * February 2027"), with the closest dates still open for registration, each one tap away. The
 * learner's own date stays until they pick one.
 */
function NoSittingCard({
  noSitting,
  onUse,
}: {
  noSitting: NoSitting;
  /** Saves the date as the goal's; false when it couldn't be saved. */
  onUse: (date: string) => Promise<boolean>;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const use = (date: string) =>
    startTransition(async () => {
      setFailed(false);
      setFailed(!(await onUse(date)));
    });

  return (
    <NoticeCard data-slot="no-sitting">
      <CalendarTile />

      <NoticeCardContent>
        <NoticeCardTitle>
          {t("No exam date in {month}", { month: formatDate(noSitting.month, "month") })}
        </NoticeCardTitle>
        <NoticeCardDescription>
          {t(
            "{count, plural, one {Your plan keeps your date unless you switch to the closest one.} other {Your plan keeps your date unless you switch to one of the closest.}}",
            { count: noSitting.closest.length },
          )}
        </NoticeCardDescription>

        <NoticeCardActions>
          {noSitting.closest.map((date) => (
            <Button
              disabled={isPending}
              focusableWhenDisabled
              key={date}
              onClick={() => use(date)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t("Use {date}", { date: formatDate(date, "long") })}
            </Button>
          ))}
        </NoticeCardActions>

        {failed && <FailedMessage />}
      </NoticeCardContent>
    </NoticeCard>
  );
}

/**
 * What the notice says about the learner's date, as a note where a page wants it read before the
 * rest (the plan's reveal, the exam's page): its day when the plan counts down to another (see
 * `NoticeDayCard`), or the closest sittings when their month has none (see `NoSittingCard`).
 */
export function NoticeDatesCard({
  document,
  noSitting,
  noticeDay,
  onUse,
}: {
  document: ExamDocument;
  noSitting: NoSitting | null;
  noticeDay: NoticeDay | null;
  /** Saves the date as the goal's; false when it couldn't be saved. */
  onUse: (date: string) => Promise<boolean>;
}) {
  if (noticeDay) {
    return (
      <NoticeDayCard day={noticeDay} document={document} onUse={() => onUse(noticeDay.date)} />
    );
  }

  return noSitting ? <NoSittingCard noSitting={noSitting} onUse={onUse} /> : null;
}
