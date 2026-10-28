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
        ? t("Goal {level} by {date}", {
            date: formatDate(targetDate, "month"),
            level: target.label,
          })
        : t("Goal {level}", { level: target.label })}
    </p>
  );
}

function LevelRow({ level }: { level: LanguageSkillLevel }) {
  const t = useExtracted();
  const skillName = useSkillName();

  return (
    <li className={`${ROW_GRID} min-h-11 py-2.5`}>
      <span className="min-w-0 text-sm font-medium text-pretty">{skillName(level.skill)}</span>
      <LevelBar score={level.score} />
      <span className="flex items-center justify-end gap-0.5 font-mono text-xs font-medium tabular-nums">
        {level.label}
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
  const rises = listRises(levels);
  const [only] = rises;

  if (!only) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("Levels move as you practice. They get more accurate every week.")}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 text-sm">
      <LineMarker aria-hidden="true">
        <TrendingUpIcon className="text-success-text size-4" />
      </LineMarker>
      {rises.length === 1
        ? t("{skill} went up to {level} since the level test.", {
            level: only.label,
            skill: skillName(only.skill),
          })
        : t("{skills} went up since the level test.", {
            skills: format.list(rises.map((rise) => skillName(rise.skill))),
          })}
    </p>
  );
}

export function SkillLevelsCard({ progress }: { progress: LanguageProgressView }) {
  const t = useExtracted();
  const { levels, target } = progress;
  const targetShare = target ? getLevelShare(target.score) : null;

  return (
    <section aria-labelledby="language-levels-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <SectionLabel id="language-levels-title">{t("Level by skill")}</SectionLabel>
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
        <ul aria-label={t("Level by skill")} className="flex flex-col [&>li+li]:border-t">
          {levels.map((level) => (
            <LevelRow key={level.skill} level={level} />
          ))}
        </ul>
      </div>

      <RiseLine levels={levels} />
    </section>
  );
}
