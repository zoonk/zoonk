"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useEnterKey, useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useEffect, useState } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useExperienceMode } from "../mode-provider";
import { TaskMainLink } from "../shell/task-frame";
import {
  type LogbookHrefs,
  LogbookProvider,
  type WeeklyRecapView,
  useLogbook,
} from "./logbook-context";
import { FoodAndBadgesSlide, NextWeekSlide, TurnaroundSlide, WeekSlide } from "./logbook-slides";

type SlideKey = "food" | "next" | "turnaround" | "week";

function useSlides(): SlideKey[] {
  const { recap } = useLogbook();

  return (["week", recap.turnaround && "turnaround", "food", "next"] as const).filter(
    (slide): slide is SlideKey => Boolean(slide),
  );
}

function Slide({ slide }: { slide: SlideKey }) {
  switch (slide) {
    case "turnaround":
      return <TurnaroundSlide />;
    case "food":
      return <FoodAndBadgesSlide />;
    case "next":
      return <NextWeekSlide />;
    case "week":
      return <WeekSlide />;
    default:
      return <WeekSlide />;
  }
}

/**
 * "Sep 21 – 27". Node's ICU puts thin spaces around the dash and browsers plain ones, so the
 * spaces are normalized to render the same on the server and in the browser (no hydration error).
 */
function useWeekRange(): string {
  const format = useFormatter();
  const { recap } = useLogbook();

  return format
    .dateTimeRange(recap.weekStart, recap.weekEnd, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .replaceAll("\u2009", " ");
}

function LogbookHeader({ current, total }: { current: number; total: number }) {
  const t = useExtracted();
  const { hrefs } = useLogbook();
  const range = useWeekRange();

  return (
    <header className="flex flex-col gap-3">
      <ol aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <li
            className={cn(
              "h-1 flex-1 rounded-full",
              index <= current ? "bg-fun-fg" : "bg-fun-track",
            )}
            key={index}
          />
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <LearnLink
          className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "fun-glass")}
          href={hrefs.close}
        >
          <XIcon aria-hidden="true" />
          <span className="sr-only">{t("Close logbook")}</span>
        </LearnLink>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold">{t("Logbook")}</h1>
          <p className="text-fun-fg2 text-xs">{range}</p>
        </div>
      </div>
    </header>
  );
}

function NotReadyNote() {
  const t = useExtracted();
  const mode = useExperienceMode();
  const { recap } = useLogbook();

  if (recap.ready) {
    return null;
  }

  // Focus calls it the weekly summary; the logbook is Fun's name for it.
  return (
    <p className="text-muted-foreground text-sm">
      {mode === "fun"
        ? t("The week isn't over yet. This is your logbook so far; it's complete on Sunday.")
        : t("The week isn't over yet. This is your summary so far; it's complete on Sunday.")}
    </p>
  );
}

/** The logbook's last step, back to studying; Enter follows it. */
function StartLink() {
  const t = useExtracted();
  const { hrefs } = useLogbook();

  return <TaskMainLink href={hrefs.start}>{t("Let's go")}</TaskMainLink>;
}

/**
 * Fun's Sunday logbook as a short story, one page at a time: the week in the learner's own
 * numbers, the biggest turnaround and why, what the buddy ate, and next week's focus. The arrows,
 * Enter and the button move through it.
 */
function FunLogbook() {
  const t = useExtracted();
  const slides = useSlides();
  const [index, setIndex] = useState(0);
  const isLast = index === slides.length - 1;
  const current = slides[index] ?? "week";

  const next = () => setIndex((value) => Math.min(slides.length - 1, value + 1));
  const back = () => setIndex((value) => Math.max(0, value - 1));

  useKeyboardCallback("ArrowRight", next, { mode: "none", screen: true });
  useKeyboardCallback("ArrowLeft", back, { mode: "none", screen: true });
  useEnterKey(next, { enabled: !isLast });

  return (
    <div className="fun-space flex min-h-dvh flex-col" data-slot="logbook">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <LogbookHeader current={index} total={slides.length} />
        {index === 0 && <NotReadyNote />}

        <main
          aria-live="polite"
          className="animate-fun-flip-calm flex flex-1 flex-col justify-center"
          key={current}
        >
          <Slide slide={current} />
        </main>

        <div className="flex gap-2">
          {index > 0 && (
            <button
              className={cn(buttonVariants({ size: "xl", variant: "ghost" }))}
              onClick={back}
              type="button"
            >
              {t("Back")}
            </button>
          )}
          {isLast ? (
            // The main link is full width (and never shrinks), so it takes what Back leaves.
            <div className="min-w-0 flex-1">
              <StartLink />
            </div>
          ) : (
            <button
              className={cn(buttonVariants({ size: "xl", variant: "lime" }), "flex-1")}
              onClick={next}
              type="button"
            >
              {t("Next")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Focus: the same week on one calm page, the weekly summary behind Progress. */
function FocusLogbook() {
  const t = useExtracted();
  const { hrefs } = useLogbook();
  const range = useWeekRange();
  const slides = useSlides();

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-4 py-6"
      data-slot="logbook"
    >
      <header className="flex items-center gap-3">
        <LearnLink
          className={buttonVariants({ size: "icon", variant: "ghost" })}
          href={hrefs.close}
        >
          <XIcon aria-hidden="true" />
          <span className="sr-only">{t("Close weekly summary")}</span>
        </LearnLink>
        <div className="flex flex-col">
          <h1 className="font-semibold">{t("Weekly summary")}</h1>
          <p className="text-muted-foreground text-xs">{range}</p>
        </div>
      </header>

      <NotReadyNote />

      {slides.map((slide) => (
        <Slide key={slide} slide={slide} />
      ))}

      <StartLink />
    </main>
  );
}

/**
 * The week's recap from core, the same numbers in both modes: Fun's logbook, told as a short
 * story on Sunday, or Focus's weekly summary. Nothing here is written by a model.
 */
export function LogbookScreen({
  hrefs,
  learnerName,
  buddy,
  recap,
}: {
  hrefs: LogbookHrefs;
  learnerName: string | null;
  buddy: LearnBuddy | null;
  recap: WeeklyRecapView;
}) {
  const mode = useExperienceMode();
  const analytics = useLearnAnalytics();

  useEffect(() => {
    analytics.track({ name: "Logbook Viewed" });
  }, [analytics]);

  return (
    <LogbookProvider value={{ buddy: mode === "fun" ? buddy : null, hrefs, learnerName, recap }}>
      {mode === "fun" ? <FunLogbook /> : <FocusLogbook />}
    </LogbookProvider>
  );
}
