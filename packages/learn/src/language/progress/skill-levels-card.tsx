"use client";

import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { ArrowDownIcon, ArrowUpIcon, TrendingUpIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { SectionLabel } from "../../_components/section-label";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { getLevelShare, listRises } from "../_utils/level-scale";
import { useSkillName } from "../_utils/use-skill-name";
import { LevelBar } from "../level-bar";

type LanguageSkillLevel = LanguageProgressView["levels"][number];

/**
 * `BAR_START` and `BAR_WIDTH` repeat these columns and gaps, so the target line sits over the bars.
 */
const ROW_GRID = "grid grid-cols-[8rem_1fr_3.5rem] items-center gap-x-3";
const BAR_START = "8rem + 0.75rem";
const BAR_WIDTH = "100% - 8rem - 3.5rem - 1.5rem";

function TargetLabel({
  target,
  targetDate,
}: Pick<LanguageProgressView, "target"> & { targetDate: string | null }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  if (!target) {
    return null;
  }

  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span
        aria-hidden="true"
        className="border-foreground/50 inline-block h-3 border-l-[1.5px] border-dashed"
      />
      {targetDate
        ? t({
            description:
              '{level} is a language level, like "B2". {date} is a month, like "May 2027".',
            message: "Goal {level} by {date}",
            values: { date: formatDate(targetDate, "month"), level: target.label },
          })
        : t("Goal {level}", { level: target.label })}
    </p>
  );
}

function useEstimatedLevel() {
  const t = useExtracted();

  return ({ label, skill }: LanguageSkillLevel): string => {
    switch (skill) {
      case "listening":
        return t("Estimated listening level: {level}", { level: label });
      case "reading":
        return t("Estimated reading level: {level}", { level: label });
      case "speaking":
        return t("Estimated speaking level: {level}", { level: label });
      case "writing":
        return t("Estimated writing level: {level}", { level: label });
      default:
        return skill satisfies never;
    }
  };
}

function useRisenEstimate() {
  const t = useExtracted();

  return ({ label, skill }: LanguageSkillLevel): string => {
    switch (skill) {
      case "listening":
        return t("Your listening estimate went up to {level}", { level: label });
      case "reading":
        return t("Your reading estimate went up to {level}", { level: label });
      case "speaking":
        return t("Your speaking estimate went up to {level}", { level: label });
      case "writing":
        return t("Your writing estimate went up to {level}", { level: label });
      default:
        return skill satisfies never;
    }
  };
}

/** The grid's name column fits only the skill's name, so the full sentence is what's read aloud. */
function LevelRow({ level }: { level: LanguageSkillLevel }) {
  const t = useExtracted();
  const skillName = useSkillName();
  const estimatedLevel = useEstimatedLevel();

  return (
    <li className={`${ROW_GRID} min-h-11 py-2.5`}>
      <span className="sr-only">{estimatedLevel(level)}</span>
      <span aria-hidden="true" className="min-w-0 text-sm font-medium text-pretty">
        {skillName(level.skill)}
      </span>
      <LevelBar score={level.score} />
      <span className="flex items-center justify-end gap-0.5 font-mono text-xs font-medium tabular-nums">
        <span aria-hidden="true">{level.label}</span>
        {level.trend === "up" && (
          <ArrowUpIcon
            aria-label={t("up since the level test")}
            className="text-success-text size-3.5 shrink-0"
          />
        )}
        {level.trend === "down" && (
          <ArrowDownIcon
            aria-label={t("down since the level test")}
            className="text-muted-foreground size-3.5 shrink-0"
          />
        )}
        {level.trend === "same" && <span aria-hidden="true" className="size-3.5 shrink-0" />}
      </span>
    </li>
  );
}

function RiseLine({ levels }: { levels: LanguageSkillLevel[] }) {
  const t = useExtracted();
  const format = useFormatter();
  const skillName = useSkillName();
  const risenEstimate = useRisenEstimate();
  const rises = listRises(levels);
  const [only] = rises;

  if (!only) {
    return null;
  }

  return (
    <p className="flex items-start gap-2 text-sm">
      <LineMarker aria-hidden="true">
        <TrendingUpIcon className="text-success-text size-4" />
      </LineMarker>
      {rises.length === 1
        ? risenEstimate(only)
        : t({
            description:
              'Two or more skills\' estimated CEFR levels rose since the level test. {skills} lists them: "Speaking and Writing".',
            message: "{skills} estimates went up",
            values: { skills: format.list(rises.map((rise) => skillName(rise.skill))) },
          })}
    </p>
  );
}

export function SkillLevelsCard({ progress }: { progress: LanguageProgressView }) {
  const t = useExtracted();
  const { levels, target } = progress;
  const targetShare = target ? getLevelShare(target.score) : null;

  if (levels.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("Levels move as you practice. They get more accurate every week.")}
      </p>
    );
  }

  return (
    <section aria-labelledby="language-levels-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <SectionLabel id="language-levels-title">
          {t({
            description:
              "Heads each skill's CEFR level (reading, listening, speaking, writing), estimated from the learner's answers to set how hard practice is.",
            message: "Practice estimates",
          })}
        </SectionLabel>
        <TargetLabel target={target} targetDate={progress.goal.targetDate} />
      </div>

      <div aria-hidden="true" className={ROW_GRID}>
        <span />
        <span className="text-muted-foreground grid grid-cols-6 text-center font-mono text-[0.6875rem] font-medium">
          {CEFR_LEVELS.map((band) => (
            <span key={band}>{band}</span>
          ))}
        </span>
        <span />
      </div>

      <div className="relative">
        {targetShare !== null && (
          <span
            aria-hidden="true"
            className="border-foreground/50 pointer-events-none absolute top-1 bottom-1 border-l-[1.5px] border-dashed"
            data-slot="language-level-target"
            style={{ left: `calc(${BAR_START} + (${BAR_WIDTH}) * ${targetShare})` }}
          />
        )}
        <ul aria-label={t("Practice estimates")} className="flex flex-col [&>li+li]:border-t">
          {levels.map((level) => (
            <LevelRow key={level.skill} level={level} />
          ))}
        </ul>
      </div>

      <RiseLine levels={levels} />

      <p className="text-muted-foreground text-sm">
        {t(
          "These estimates guide practice difficulty. Certificates follow the lessons completed in your plan.",
        )}
      </p>
    </section>
  );
}
