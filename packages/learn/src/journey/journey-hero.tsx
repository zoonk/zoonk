"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";
import { ArrowRightIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ProgressRing } from "../_components/progress-ring";
import { Surface } from "../_components/surface";
import { daysUntilIsoDate } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { getBandFill } from "../language/_utils/level-scale";
import { CanDoList } from "../language/progress/can-do-list";
import { SkillLevelsCard } from "../language/progress/skill-levels-card";
import { SpeakingMockCard } from "../language/progress/speaking-mock-card";
import { usePlanScreen } from "../plan/plan-context";
import { PlanStatusLabel } from "../plan/plan-status-label";
import { PreparationDetails } from "./preparation/preparation-details";

const PERCENT = 100;

/**
 * Where the learner stands, as the hero shows it: preparation for exam and learn goals, the level
 * across skills for a language goal (with its speaking mock, when the goal's exam has one).
 */
export type JourneyStanding =
  | {
      /**
       * An exam's number reads as preparation for it; any other goal's as how far along the way
       * the learner is, so a goal learned for its own sake never reads like exam prep.
       */
      forExam: boolean;
      kind: "preparation";
      preparation: NonNullable<ProgressView["preparation"]>;
      stillNeeded: ProgressView["stillNeeded"];
    }
  | { kind: "language"; language: LanguageProgressView; startSpeakingMock: () => Promise<boolean> };

type PlanStatus = PlanView["status"];

/** The level as six rising bars, A1 to C2, filled up to the learner's and outlined at the target. */
function LevelBars({ level, target }: { level: string; target: string | null }) {
  const score = parseCefrScore(level) ?? 0;
  const targetScore = target ? parseCefrScore(target) : null;
  const targetBand = targetScore === null ? -1 : Math.floor(targetScore);

  return (
    <span aria-hidden="true" className="flex h-20 w-20 shrink-0 items-end gap-1">
      {CEFR_LEVELS.map((band, index) => (
        <span
          className={cn(
            "bg-muted relative flex-1 overflow-hidden rounded-md",
            index === targetBand && "ring-success ring-2 ring-offset-1 ring-offset-transparent",
          )}
          key={band}
          style={{ height: `${((index + 1) / CEFR_LEVELS.length) * PERCENT}%` }}
        >
          <span
            className="bg-success absolute inset-x-0 bottom-0"
            style={{ height: `${getBandFill({ band: index, score }) * PERCENT}%` }}
          />
        </span>
      ))}
    </span>
  );
}

/**
 * The hero's anchor: preparation (or another goal's share of the way) as a ring with its share in
 * it, or a language goal's level as six rising bars.
 */
function HeroAnchor({ standing }: { standing: JourneyStanding }) {
  const formatShare = useFormatShare();

  if (standing.kind === "preparation") {
    return (
      <ProgressRing share={standing.preparation.value}>
        <span className="text-lg font-bold tracking-tight tabular-nums">
          {formatShare(standing.preparation.value)}
        </span>
      </ProgressRing>
    );
  }

  return (
    <LevelBars
      level={standing.language.level ?? "A1"}
      target={standing.language.target?.label ?? null}
    />
  );
}

/** A language goal's level after its title: "A2+ → B1+". */
function LevelValue({
  language,
}: {
  language: Extract<JourneyStanding, { kind: "language" }>["language"];
}) {
  const t = useExtracted();
  const { level, target } = language;

  return (
    <span className="flex items-baseline gap-1.5 text-2xl font-bold tracking-tight">
      {level ?? t("Not yet")}
      {target && (
        <span className="text-muted-foreground flex items-center gap-1 text-lg font-semibold">
          <ArrowRightIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("goal")}</span>
          {target.label}
        </span>
      )}
    </span>
  );
}

/** "32 days left · 45 min a day": the plan's date and time a day, under the hero's title. */
function HeroFacts() {
  const t = useExtracted();
  const today = useMountTime();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const { dailyMinutes, targetDate, targetDateEstimated } = plan.schedule;
  const days = targetDate ? daysUntilIsoDate({ isoDate: targetDate, today }) : null;

  const daysLeft =
    days !== null &&
    (targetDateEstimated
      ? t("{days, plural, one {About # day left} other {About # days left}}", { days })
      : t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", { days }));

  const facts = [daysLeft, t("{time} a day", { time: formatDuration(dailyMinutes) })].filter(
    Boolean,
  );

  return <span className="text-muted-foreground text-sm">{facts.join(" · ")}</span>;
}

function useStandingTitle(standing: JourneyStanding): string {
  const t = useExtracted();

  if (standing.kind === "language") {
    return t("Your level");
  }

  return standing.forExam ? t("Your preparation") : t("Your progress");
}

function SheetBody({ examHref, standing }: { examHref: string | null; standing: JourneyStanding }) {
  if (standing.kind === "preparation") {
    return (
      <PreparationDetails
        examHref={examHref}
        forExam={standing.forExam}
        preparation={standing.preparation}
        stillNeeded={standing.stillNeeded}
      />
    );
  }

  const { language, startSpeakingMock } = standing;

  return (
    <div className="flex flex-col gap-7">
      <SkillLevelsCard
        className="rounded-none border-0 bg-transparent p-0 shadow-none sm:p-0"
        progress={language}
      />
      <CanDoList canDo={language.canDo} />
      {language.speakingMock && (
        <SpeakingMockCard exam={language.speakingMock} onStart={startSpeakingMock} />
      )}
    </div>
  );
}

/**
 * Where the learner stands, as a card: preparation as a ring with its share in it (a language
 * goal's level as bars), its name, the days left and the time a day, and the plan's status. A tap
 * opens the details behind the number in a sheet ("Your preparation", "Your progress" or "Your
 * level"). Under a hairline, the Journey's actions: "Adjust plan" and its "…" (`actions`).
 */
export function JourneyHero({
  actions,
  examHref,
  standing,
  status,
}: {
  actions: React.ReactNode;
  /** The exam's page, where the sheet's "Take your first mock exam" leads; null without one. */
  examHref: string | null;
  standing: JourneyStanding;
  status: PlanStatus;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const title = useStandingTitle(standing);

  return (
    <>
      <Surface
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 overflow-hidden"
        data-slot="journey-standing"
      >
        <button
          aria-haspopup="dialog"
          className="hover:bg-muted/40 focus-visible:ring-ring/50 flex w-full items-center gap-4 p-4 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset sm:p-5"
          data-slot="journey-hero"
          onClick={() => setOpen(true)}
          type="button"
        >
          <HeroAnchor standing={standing} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xl font-bold tracking-tight">{title}</span>
            {standing.kind === "language" && <LevelValue language={standing.language} />}
            <HeroFacts />
            {status && <PlanStatusLabel className="mt-1" status={status} />}
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="text-muted-foreground/60 size-5 shrink-0"
          />
          <span className="sr-only">{t("See details")}</span>
        </button>

        <div className="border-foreground/10 flex flex-wrap items-center gap-2 border-t px-4 py-3">
          {actions}
        </div>
      </Surface>

      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerPopup>
          <DrawerHeader className="flex-row items-center justify-between gap-3">
            <DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
            <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
              <XIcon aria-hidden="true" />
              <span className="sr-only">{t("Close")}</span>
            </DrawerClose>
          </DrawerHeader>
          <DrawerContent className="pt-2">
            <SheetBody examHref={examHref} standing={standing} />
          </DrawerContent>
        </DrawerPopup>
      </Drawer>
    </>
  );
}
