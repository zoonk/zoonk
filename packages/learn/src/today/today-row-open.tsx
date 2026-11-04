"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { LearnLink } from "../learn-link";
import { type DayStep } from "../session/session-types";
import { useBlockTitle } from "../session/use-block-copy";
import { useTodayScreen } from "./today-context";

/**
 * Its `::after` stretches over the whole row, so the row is one target with its focus ring there.
 */
export const ROW_OPEN_CLASS =
  "flex min-w-0 text-left outline-none after:absolute after:top-1/2 after:h-full after:min-h-11 after:-translate-y-1/2 after:rounded-[0.625rem] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 aria-disabled:cursor-default";

export function RowOpen({
  block,
  children,
  countsTowardMission,
  isNext,
}: {
  block: DayStep;
  children: React.ReactNode;
  countsTowardMission: boolean;
  isNext: boolean;
}) {
  const { actions } = useTodayScreen();
  const t = useExtracted();
  const title = useBlockTitle();
  const [pending, startTransition] = useTransition();

  const open = () => {
    startTransition(async () => {
      await actions.openBlock(block);
    });
  };

  return (
    <button
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      aria-label={`${title(block)}${countsTowardMission ? t(", counts toward a mission") : ""}`}
      className={cn(ROW_OPEN_CLASS, isNext ? "after:inset-x-0" : "after:-inset-x-2.5")}
      data-slot="today-row-open"
      onClick={pending ? undefined : open}
      type="button"
    >
      {children}
    </button>
  );
}

export function LessonAgainLink({
  block,
  children,
  lessonId,
}: {
  block: DayStep;
  children: React.ReactNode;
  lessonId: string;
}) {
  const { actions } = useTodayScreen();
  const t = useExtracted();
  const title = useBlockTitle();

  return (
    <LearnLink
      aria-label={`${title(block)}${t(", done")}`}
      className={cn(ROW_OPEN_CLASS, "after:-inset-x-2.5")}
      href={actions.lessonAgainHref(lessonId)}
      lessonWritten
    >
      {children}
    </LearnLink>
  );
}
