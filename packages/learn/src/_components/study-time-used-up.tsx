"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { daysBetween, useFormatIsoDate } from "../_utils/iso-date";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { TaskActions } from "./task-layout";

type NextStudyDay = {
  /** The next day its plan studies, YYYY-MM-DD; null (or absent) when the page can't say. */
  nextStudyDate?: string | null;
  /** The learner's today, YYYY-MM-DD, which "tomorrow" counts from. */
  today?: string;
};

/**
 * When it's back: tomorrow, or the day its plan studies next, named, since tomorrow may be a rest
 * day; the next session when the page doesn't know that day.
 */
function BackOn({ nextStudyDate, today }: NextStudyDay) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  if (!nextStudyDate || !today) {
    return t("You've reached today's study time. It'll be in your next session.");
  }

  if (daysBetween(today, nextStudyDate) === 1) {
    return t("You've reached today's study time. It'll be here tomorrow.");
  }

  return t("You've reached today's study time. It'll be here on {day}.", {
    day: formatDate(nextStudyDate, "weekday"),
  });
}

/**
 * An intro's note once today's study time is used up. The owning footer puts it in its status
 * region, mounted from the start, so a note that replaces a refused Start is read out as it
 * arrives; a page that opens past the limit says where things stand without an alert, since
 * Next.js already announces the new page assertively.
 */
export function StudyTimeUsedUpNote({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm text-pretty">{children}</p>;
}

/** The note for a call or phase challenge, which comes back on its own: when it's back. */
export function StudyTimeUsedUpLine({ nextStudyDate, today }: NextStudyDay) {
  return (
    <StudyTimeUsedUpNote>
      <BackOn nextStudyDate={nextStudyDate} today={today} />
    </StudyTimeUsedUpNote>
  );
}

/**
 * The way back to Today in Start's place, with nothing to start. When an action that isn't study is
 * the way on instead (`main`, such as the week's challenge's Move to Monday, which keeps it), that
 * one is the main action, which Enter presses, and the way back to Today the outline one before it:
 * beside it from `lg`, the main action last, and above it on a phone, where both labels don't fit
 * side by side in every language.
 */
export function StudyTimeUsedUpActions({ href, main }: { href: string; main?: React.ReactNode }) {
  const t = useExtracted();

  if (!main) {
    return (
      <TaskActions>
        <TaskMainLink href={href}>{t("Back to Today")}</TaskMainLink>
      </TaskActions>
    );
  }

  return (
    <TaskActions className="max-lg:flex-col max-lg:items-stretch">
      <LearnLink className={buttonVariants({ size: "xl", variant: "outline" })} href={href}>
        {t("Back to Today")}
      </LearnLink>
      {main}
    </TaskActions>
  );
}
