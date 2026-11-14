"use client";

import { type NoSitting, type NoticeDay } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { CalendarCheckIcon, CalendarDaysIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment, useTransition } from "react";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { useChangeSaveFailed } from "../_components/save-error";
import { useFormatIsoDate } from "../_utils/iso-date";

export function useNoticeDayText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return ({ date, estimated }: NoticeDay): string =>
    estimated
      ? t("The exam's likely date is now {date}.", { date: formatDate(date, "long") })
      : t("The exam is on {date}.", { date: formatDate(date, "long") });
}

export function NoSittingWords({
  disabled,
  noSitting,
  onUse,
}: {
  disabled: boolean;
  noSitting: NoSitting;
  onUse: (date: string) => void;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (
    <>
      <span>{t("No exam date in {month}", { month: formatDate(noSitting.month, "month") })}</span>
      {noSitting.closest.map((date) => (
        <Fragment key={date}>
          <span aria-hidden="true">{" · "}</span>
          <Button
            disabled={disabled}
            focusableWhenDisabled
            onClick={() => onUse(date)}
            type="button"
            variant="link"
          >
            {t("Use {date}", { date: formatDate(date, "long") })}
          </Button>
        </Fragment>
      ))}
    </>
  );
}

export function UseDateButton({
  busy = false,
  disabled = false,
  onUse,
  variant = "outline",
}: {
  busy?: boolean;
  disabled?: boolean;
  onUse: () => void;
  variant?: "outline" | "secondary";
}) {
  const t = useExtracted();

  return (
    <form action={() => onUse()} className="contents">
      <Button
        busy={busy}
        disabled={disabled}
        focusableWhenDisabled
        icon={<CalendarCheckIcon aria-hidden="true" />}
        size="sm"
        type="submit"
        variant={variant}
      >
        {t("Use this date")}
      </Button>
    </form>
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

function NoticeDayCard({ day, onUse }: { day: NoticeDay; onUse: () => Promise<boolean> }) {
  const text = useNoticeDayText();
  const saveFailed = useChangeSaveFailed();
  const [isPending, startTransition] = useTransition();

  const use = () =>
    startTransition(async () => {
      const { data: saved } = await safeAsync(onUse);

      if (!saved) {
        saveFailed();
      }
    });

  return (
    <NoticeCard data-slot="notice-day">
      <CalendarTile />

      <NoticeCardContent>
        <NoticeCardTitle>{text(day)}</NoticeCardTitle>
        <NoticeCardActions>
          <UseDateButton busy={isPending} onUse={use} variant="secondary" />
        </NoticeCardActions>
      </NoticeCardContent>
    </NoticeCard>
  );
}

function NoSittingCard({
  noSitting,
  onUse,
}: {
  noSitting: NoSitting;
  /** False when it couldn't be saved. */
  onUse: (date: string) => Promise<boolean>;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const saveFailed = useChangeSaveFailed();
  const [isPending, startTransition] = useTransition();

  const use = (date: string) =>
    startTransition(async () => {
      const { data: saved } = await safeAsync(() => onUse(date));

      if (!saved) {
        saveFailed();
      }
    });

  return (
    <NoticeCard data-slot="no-sitting">
      <CalendarTile />

      <NoticeCardContent>
        <NoticeCardTitle>
          {t("No exam date in {month}", { month: formatDate(noSitting.month, "month") })}
        </NoticeCardTitle>
        <form className="contents">
          <NoticeCardActions>
            {noSitting.closest.map((date) => (
              <Button
                disabled={isPending}
                focusableWhenDisabled
                formAction={() => use(date)}
                key={date}
                size="sm"
                type="submit"
                variant="secondary"
              >
                {t("Use {date}", { date: formatDate(date, "long") })}
              </Button>
            ))}
          </NoticeCardActions>
        </form>
      </NoticeCardContent>
    </NoticeCard>
  );
}

export function NoticeDatesCard({
  noSitting,
  noticeDay,
  onUse,
}: {
  noSitting: NoSitting | null;
  noticeDay: NoticeDay | null;
  /** False when it couldn't be saved. */
  onUse: (date: string) => Promise<boolean>;
}) {
  if (noticeDay) {
    return <NoticeDayCard day={noticeDay} onUse={() => onUse(noticeDay.date)} />;
  }

  return noSitting ? <NoSittingCard noSitting={noSitting} onUse={onUse} /> : null;
}
