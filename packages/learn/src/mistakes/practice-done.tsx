"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { StatTile, StatTileLabel, StatTileValue } from "../_components/stat-tile";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { type MistakePracticeSummary } from "./mistake-practice-state";

const SECONDS_PER_MINUTE = 60;

function BackLink({ backHref }: { backHref: string }) {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const backRef = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg", variant: primaryVariant }), "rounded-full")}
      href={backHref}
      ref={backRef}
    >
      {t("Back to the notebook")}
    </LearnLink>
  );
}

/** "45 s" under a minute, "3 min" after: the time the run added to today. */
function usePracticeTime() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (seconds: number): string =>
    seconds < SECONDS_PER_MINUTE
      ? t("{seconds} s", { seconds: String(seconds) })
      : formatDuration(Math.round(seconds / SECONDS_PER_MINUTE));
}

/** What the run earned, counted toward today like any practice. */
function Earned({ summary }: { summary: MistakePracticeSummary }) {
  const t = useExtracted();
  const practiceTime = usePracticeTime();

  return (
    <div className="grid w-full grid-cols-3 gap-2">
      <StatTile>
        <StatTileValue>{t("+{points}", { points: String(summary.brainPower) })}</StatTileValue>
        <StatTileLabel>{t("Brain Power")}</StatTileLabel>
      </StatTile>

      <StatTile>
        <StatTileValue>{practiceTime(summary.seconds)}</StatTileValue>
        <StatTileLabel>{t("Practice time")}</StatTileLabel>
      </StatTile>

      <StatTile>
        <StatTileValue>
          {t("{correct} of {total}", {
            correct: String(summary.correct),
            total: String(summary.total),
          })}
        </StatTileValue>
        <StatTileLabel>{t("Right")}</StatTileLabel>
      </StatTile>
    </div>
  );
}

/** Nothing is due for practice yet: mistakes come back from the day after they're made. */
export function NothingToPractice({ backHref }: { backHref: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
      <h1 className="text-2xl font-semibold">{t("Nothing to practice yet")}</h1>
      <p className="text-muted-foreground">
        {t(
          "Mistakes come back for practice from the day after you make them, when practice sticks better.",
        )}
      </p>
      <BackLink backHref={backHref} />
    </div>
  );
}

/**
 * The end of a run, at the last question or stopped early: mistakes fixed, and what the practice
 * added to today (Brain Power, time, right answers), the same in both modes.
 */
export function PracticeDone({
  backHref,
  fixed,
  summary,
}: {
  backHref: string;
  fixed: number;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();

  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-10 text-center"
      role="status"
    >
      <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold">
        {t("Practice done")}
      </h1>
      <p className="text-muted-foreground">
        {t(
          "{fixed, plural, =0 {The rest come back another day, when they stick better.} one {# mistake fixed. The rest come back another day.} other {# mistakes fixed. The rest come back another day.}}",
          { fixed },
        )}
      </p>
      {summary && <Earned summary={summary} />}
      <BackLink backHref={backHref} />
    </div>
  );
}

/** The run's answers being counted toward today. */
export function PracticeSaving() {
  const t = useExtracted();

  return (
    <p
      className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm"
      role="status"
    >
      <Spinner />
      {t("Saving your practice…")}
    </p>
  );
}
