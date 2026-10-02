"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { NotebookPenIcon, ScaleIcon, TimerIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Meter } from "../_components/meter";
import { SectionLabel } from "../_components/section-label";
import { useCauseLabel } from "../mistakes/use-cause-label";
import { useMockScreen } from "./mock-context";

const PERCENT = 100;

const CARD_CLASS =
  "bg-muted/60 in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl p-4 in-data-[mode=fun]:bg-transparent";

function Insight({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof TimerIcon;
  title: string;
}) {
  return (
    <li className={CARD_CLASS}>
      <LineMarker aria-hidden="true">
        <Icon className="text-muted-foreground in-data-[mode=fun]:text-fun-accent-cyan size-5" />
      </LineMarker>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-semibold">{title}</h3>
        <div className="text-muted-foreground text-sm">{children}</div>
      </div>
    </li>
  );
}

/** The slowest area against the exam's pace, or that the pace held. */
function TimingInsight() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const result = runner.view.result;

  if (!result) {
    return null;
  }

  const slowest = result.areas
    .filter((area) => area.targetSecondsPerQuestion !== null)
    .map((area) => ({
      ...area,
      over: area.secondsPerQuestion - (area.targetSecondsPerQuestion ?? 0),
    }))
    .toSorted((first, second) => second.over - first.over)[0];

  return (
    <Insight icon={TimerIcon} title={t("Timing")}>
      <p>
        {slowest && slowest.over > 0
          ? t("{seconds} seconds per {area} question. Aim for {target} or less.", {
              area: slowest.name,
              seconds: String(slowest.secondsPerQuestion),
              target: String(Math.round(slowest.targetSecondsPerQuestion ?? 0)),
            })
          : t("You kept the exam's pace.")}
      </p>
      {result.unansweredAtTimeout > 0 && (
        <p>
          {t(
            "{count, plural, one {# question was} other {# questions were}} left when time ran out.",
            { count: result.unansweredAtTimeout },
          )}
        </p>
      )}
    </Insight>
  );
}

/** ENEM: easy questions missed next to hard ones right, which item response theory weighs. */
function ConsistencyInsight() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const coherence = runner.view.result?.coherence;

  if (!coherence || coherence.isCoherent) {
    return null;
  }

  return (
    <Insight icon={ScaleIcon} title={t("Consistency")}>
      {t(
        "{easy, plural, one {# easy one} other {# easy ones}} wrong, {hard, plural, one {# hard one} other {# hard ones}} right. Item response theory weighs that: review the easy ones first.",
        { easy: coherence.easyWrong, hard: coherence.hardRight },
      )}
    </Insight>
  );
}

/** Cebraspe: how often the learner is right when sure versus when they flagged a statement. */
function CalibrationInsight() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const calibration = runner.view.result?.calibration;

  if (!calibration || calibration.unsure.answered === 0) {
    return null;
  }

  return (
    <Insight icon={ScaleIcon} title={t("When to leave it blank")}>
      <p>
        {t(
          "Sure: {sureRight} of {sureAnswered} right. Flagged as unsure: {unsureRight} of {unsureAnswered} right.",
          {
            sureAnswered: String(calibration.sure.answered),
            sureRight: String(calibration.sure.right),
            unsureAnswered: String(calibration.unsure.answered),
            unsureRight: String(calibration.unsure.right),
          },
        )}
      </p>
      {calibration.advice === "blankUnsure" && (
        <p>
          {t(
            "Leaving the unsure ones blank would have added {points, plural, one {# point} other {# points}}.",
            { points: calibration.blankingGain },
          )}
        </p>
      )}
      {calibration.advice === "keepAnswering" && (
        <p>{t("Your unsure answers still earned points, so keep answering them.")}</p>
      )}
    </Insight>
  );
}

const CAUSE_COLORS: Record<string, string> = {
  gap: "bg-foreground in-data-[mode=fun]:bg-fun-accent-violet",
  guess: "bg-muted-foreground/40",
  misread: "bg-warning",
  none: "bg-muted-foreground/20",
  time: "bg-destructive/70",
  trap: "bg-fun-accent-cyan",
};

/** Mistakes by cause, the way the notebook sorts them for their drills. */
function MistakesInsight() {
  const t = useExtracted();
  const format = useFormatter();
  const { runner } = useMockScreen();
  const label = useCauseLabel();
  const { mistakes } = runner.view;
  const total = mistakes.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) {
    return null;
  }

  return (
    <Insight icon={NotebookPenIcon} title={t("Your mistakes")}>
      <Meter className="mt-1 flex h-2">
        {mistakes.map((entry) => (
          <span
            className={cn("h-full", CAUSE_COLORS[entry.cause ?? "none"])}
            key={entry.cause ?? "none"}
            style={{ width: `${(entry.count / total) * PERCENT}%` }}
          />
        ))}
      </Meter>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {mistakes.map((entry) => (
          <li className="flex items-center gap-1.5" key={entry.cause ?? "none"}>
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-full", CAUSE_COLORS[entry.cause ?? "none"])}
            />
            {label(entry.cause)}
            <span className="tabular-nums opacity-70">{format.number(entry.count)}</span>
          </li>
        ))}
      </ul>
    </Insight>
  );
}

/** What the mock showed beyond the score: time, consistency or calibration, and mistakes. */
export function MockResultInsights() {
  const t = useExtracted();

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{t("What the mock exam showed")}</SectionLabel>
      <ul className="flex flex-col gap-2">
        <TimingInsight />
        <ConsistencyInsight />
        <CalibrationInsight />
        <MistakesInsight />
      </ul>
    </section>
  );
}
