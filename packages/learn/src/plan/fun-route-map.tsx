"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, SwordsIcon, TrophyIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { ChapterTestOutLink, canTestOut } from "./chapter-test-out-link";
import { FunMoon } from "./fun-moon";
import { usePlanScreen } from "./plan-context";
import { findWeekCheckpoint } from "./use-item-title";
import { usePhaseName } from "./use-phase-name";
import { useShortDays } from "./use-short-plan";

function usePhaseDates() {
  const formatDate = useFormatIsoDate();
  const t = useExtracted();

  return function phaseDates(phase: PlanPhaseView): string | null {
    // A plan for a test days away counts in days, so its phases say the weekday.
    const style = phase.short ? "weekday" : "day";

    if (phase.startDate && phase.endDate && phase.startDate !== phase.endDate) {
      return t("{start} to {end}", {
        end: formatDate(phase.endDate, style),
        start: formatDate(phase.startDate, style),
      });
    }

    const date = phase.endDate ?? phase.startDate;
    return date ? formatDate(date, style) : null;
  };
}

function Marker({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <span className="fun-glass inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
      {icon}
      {children}
    </span>
  );
}

/**
 * The phase's boss at its end, and this week's Big Challenge, marked on the way. A plan for a test
 * days away has no bosses: its only challenge is the short mock.
 */
function CurrentMarkers({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const challenge = findWeekCheckpoint(plan.week.days.flatMap((day) => day.items));

  return (
    <div className="flex flex-wrap gap-2">
      {phase.endDate && !phase.short && (
        <Marker icon={<SwordsIcon aria-hidden="true" className="text-fun-accent-violet size-4" />}>
          {t("Boss · {date}", { date: formatDate(phase.endDate) })}
        </Marker>
      )}
      {challenge?.scheduledFor && (
        <Marker icon={<TrophyIcon aria-hidden="true" className="text-fun-gold size-4" />}>
          {t("Big Challenge · {day}", { day: formatDate(challenge.scheduledFor, "weekday") })}
        </Marker>
      )}
    </div>
  );
}

/** Chapters the learner may already know, each with a quick test that skips it. */
function FunTestOuts({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const chapters = (phase.chapters ?? []).filter((chapter) => canTestOut(chapter));

  if (chapters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-fun-fg2 text-sm">
        {t("Know some of this already? Test out and skip it.")}
      </p>
      {/* Each row names its chapter and says what tapping does, whatever the title's length. */}
      <ul className="flex flex-col gap-2">
        {chapters.map((chapter) => (
          <li key={chapter.chapterId}>
            <ChapterTestOutLink
              chapter={chapter}
              className="fun-glass flex w-full rounded-2xl px-4 py-3 text-sm"
            >
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{chapter.title}</span>
                <span className="text-fun-accent-cyan text-xs font-semibold">{t("Test out")}</span>
              </span>
            </ChapterTestOutLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chapters of the current phase as lit dots: "5 of 14 moons". */
function ChapterDots({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const chapters = phase.chapters ?? [];
  const done = chapters.filter((chapter) => chapter.state === "done").length;

  // The dots lead their count on one line, so a phase of one chapter never shows a lone dot. The
  // chapter in progress is an unlit ring; finished ones glow.
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div aria-hidden="true" className="flex flex-wrap gap-1.5">
        {chapters.map((chapter, index) => (
          <span
            className={cn(
              "size-3 rounded-full",
              chapter.state === "done" && "bg-fun-accent-lime",
              chapter.state === "current" && "border-fun-accent-lime border-2",
              chapter.state === "upcoming" && "bg-fun-track",
            )}
            key={chapter.chapterId ?? index}
          />
        ))}
      </div>
      <p className="text-fun-fg2 text-xs">
        {t("{total, plural, one {{done, number} of # moon} other {{done, number} of # moons}}", {
          done,
          total: phase.chapterCount,
        })}
      </p>
    </div>
  );
}

/**
 * "Phase 2 · You are here", "Phase 1 · Done" or just "Phase 3": the phase's place on the route. A
 * plan for a test days away counts days instead: "Day 1 of 3 · You are here".
 */
function usePhaseEyebrow() {
  const t = useExtracted();
  const shortDays = useShortDays();

  return (phase: PlanPhaseView): string => {
    const days = shortDays(phase.short);
    const number = phase.index + 1;

    if (days && phase.state === "current") {
      return t("{days} · You are here", { days });
    }

    if (days) {
      return phase.state === "done" ? t("{days} · Done", { days }) : days;
    }

    if (phase.state === "current") {
      return t("Phase {number, number} · You are here", { number });
    }

    return phase.state === "done"
      ? t("Phase {number, number} · Done", { number })
      : t("Phase {number, number}", { number });
  };
}

function RouteStop({
  buddy,
  phase,
  tools,
}: {
  buddy: LearnBuddy | null;
  phase: PlanPhaseView;
  tools?: React.ReactNode;
}) {
  const phaseEyebrow = usePhaseEyebrow();
  const phaseName = usePhaseName();
  const phaseDates = usePhaseDates();
  const isCurrent = phase.state === "current";
  const dates = phaseDates(phase);

  return (
    <li className="relative flex gap-4 pb-8 last:pb-0" data-state={phase.state}>
      <div className="relative flex w-16 shrink-0 justify-center">
        {phase.state === "done" ? (
          <span className="bg-fun-accent-lime flex size-9 items-center justify-center rounded-full text-(--fun-inv-fg)">
            <CheckIcon aria-hidden="true" className="size-5" />
          </span>
        ) : (
          <FunMoon index={phase.index} size={isCurrent ? "lg" : "md"} />
        )}
        {isCurrent && buddy && (
          <Buddy
            beltColor={buddy.beltColor}
            className="absolute -top-7 -right-3 size-10"
            energy={buddy.energy}
            glasses={buddy.glasses}
            kind={buddy.kind}
            studiedToday={buddy.studiedToday}
          />
        )}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", isCurrent ? "pt-1" : "pt-0.5")}>
        <p
          className={cn(
            "text-xs font-semibold tracking-widest uppercase",
            isCurrent ? "text-fun-accent-cyan" : "text-fun-fg3",
          )}
        >
          {phaseEyebrow(phase)}
        </p>
        <h3 className="font-fun-display text-base font-semibold">{phaseName(phase)}</h3>
        {dates && <p className="text-fun-fg2 text-sm">{dates}</p>}
        {isCurrent && <ChapterDots phase={phase} />}
        {isCurrent && <CurrentMarkers phase={phase} />}
        {isCurrent && <FunTestOuts phase={phase} />}
        {isCurrent && tools}
      </div>
    </li>
  );
}

/**
 * The plan as a climb to the destination planet: the goal on top, each phase a moon, the current
 * one lit with the buddy on it and ending with `tools`, the tools it uses (`PlanTools`). Later
 * phases stay one line each, as in Focus.
 */
export function FunRouteMap({
  buddy,
  tools,
}: {
  buddy: LearnBuddy | null;
  tools?: React.ReactNode;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { goal, plan } = usePlanScreen();
  const phases = plan.phases.toReversed();
  const { targetDate } = plan.schedule;

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="border-fun-dash absolute top-10 bottom-4 left-8 border-l-2 border-dashed"
      />

      <div className="relative flex gap-4 pb-8">
        <div className="flex w-16 shrink-0 justify-center">
          <span aria-hidden="true" className="fun-planet block size-16" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 pt-2">
          <h2 className="font-fun-display text-lg font-bold">{goal.title}</h2>
          <p className="text-fun-fg2 text-sm">
            {targetDate
              ? t("Destination · {date}", { date: formatDate(targetDate, "long") })
              : t("Destination")}
          </p>
        </div>
      </div>

      <ol aria-label={t("Phases of your route")} className="relative">
        {phases.map((phase) => (
          <RouteStop key={phase.index} buddy={buddy} phase={phase} tools={tools} />
        ))}
      </ol>
    </div>
  );
}
