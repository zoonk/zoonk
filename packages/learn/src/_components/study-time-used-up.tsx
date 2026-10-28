"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { daysBetween, useFormatIsoDate } from "../_utils/iso-date";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { TaskActions } from "./task-layout";

type NextStudyDay = { nextStudyDate?: string | null; today?: string };

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

/** Not an alert: its footer's status region reads it out, and Next.js announces a new page itself. */
export function StudyTimeUsedUpNote({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm text-pretty">{children}</p>;
}

export function StudyTimeUsedUpLine({ nextStudyDate, today }: NextStudyDay) {
  return (
    <StudyTimeUsedUpNote>
      <BackOn nextStudyDate={nextStudyDate} today={today} />
    </StudyTimeUsedUpNote>
  );
}

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
