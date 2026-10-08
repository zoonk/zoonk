"use client";

import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  HeadphonesIcon,
  MicIcon,
  PenLineIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { getBandFill, getLevelShare, listRises } from "../_utils/level-scale";
import { useSkillName } from "../_utils/use-skill-name";
import { LanguageCard, LanguageCardTitle } from "../language-card";

type LanguageSkillLevel = LanguageProgressView["levels"][number];
type Skill = LanguageSkillLevel["skill"];

const PERCENT = 100;

/** Name, bar and level columns; the target line is placed over the bar column with the same sizes. */
const ROW_GRID = "grid grid-cols-[7rem_1fr_3.5rem] items-center gap-x-3";
const BAR_START = "7rem + 0.75rem";
const BAR_WIDTH = "100% - 7rem - 3.5rem - 1.5rem";

const SKILL_ICONS = {
  listening: HeadphonesIcon,
  reading: BookOpenIcon,
  speaking: MicIcon,
  writing: PenLineIcon,
} as const satisfies Record<Skill, unknown>;

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
        className="border-success inline-block h-3 border-l-2 border-dashed"
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

function LevelBar({ score }: { score: number }) {
  return (
    <div aria-hidden="true" className="flex gap-0.75">
      {CEFR_LEVELS.map((band, index) => (
        <span
          className="bg-muted h-2.5 flex-1 overflow-hidden first:rounded-l-full last:rounded-r-full"
          key={band}
        >
          <span
            className="bg-primary block h-full"
            style={{ width: `${getBandFill({ band: index, score }) * PERCENT}%` }}
          />
        </span>
      ))}
    </div>
  );
}

function LevelRow({ level }: { level: LanguageSkillLevel }) {
  const t = useExtracted();
  const skillName = useSkillName();
  const Icon = SKILL_ICONS[level.skill];

  return (
    <li className={ROW_GRID}>
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate">{skillName(level.skill)}</span>
      </span>
      <LevelBar score={level.score} />
      <span className="flex items-center justify-end gap-0.5 font-semibold tabular-nums">
        {level.label}
        {level.trend === "up" && (
          <ArrowUpIcon
            aria-label={t("up since the level test")}
            className="text-success size-3.5 shrink-0"
          />
        )}
        {level.trend === "down" && (
          <ArrowDownIcon
            aria-label={t("down since the level test")}
            className="text-muted-foreground size-3.5 shrink-0"
          />
        )}
        {/* An empty arrow's width keeps every level in one column, moved or not. */}
        {level.trend === "same" && <span aria-hidden="true" className="size-3.5 shrink-0" />}
      </span>
    </li>
  );
}

/** Every skill with an up arrow, so the sentence and the arrows always agree. */
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
        <TrendingUpIcon className="text-success size-4" />
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

/**
 * Level by skill on the A1 to C2 scale: one bar per skill, the learner's target as a dashed line
 * across them, an arrow for each skill that moved since the level test, and the biggest rise.
 */
export function SkillLevelsCard({
  className,
  progress,
}: {
  className?: string;
  progress: LanguageProgressView;
}) {
  const t = useExtracted();
  const { levels, target } = progress;
  const targetShare = target ? getLevelShare(target.score) : null;

  return (
    <LanguageCard aria-labelledby="language-levels-title" className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <LanguageCardTitle id="language-levels-title">{t("Level by skill")}</LanguageCardTitle>
        <TargetLabel target={target} targetDate={progress.goal.targetDate} />
      </div>

      <div aria-hidden="true" className={ROW_GRID}>
        <span />
        <span className="text-muted-foreground grid grid-cols-6 text-center text-xs font-medium tabular-nums">
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
            className="border-success pointer-events-none absolute -top-1 -bottom-1 border-l-2 border-dashed"
            data-slot="language-level-target"
            style={{ left: `calc(${BAR_START} + (${BAR_WIDTH}) * ${targetShare})` }}
          />
        )}
        <ul aria-label={t("Level by skill")} className="flex flex-col gap-3.5">
          {levels.map((level) => (
            <LevelRow key={level.skill} level={level} />
          ))}
        </ul>
      </div>

      <RiseLine levels={levels} />
    </LanguageCard>
  );
}
