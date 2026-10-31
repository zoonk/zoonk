import { getBeltLabel } from "@/lib/belt-colors";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { LEVELS_PER_COLOR } from "@zoonk/utils/belt-level";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { formatWholeNumber } from "@zoonk/utils/number";
import { BrainIcon, ChevronsUpIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { STAT_PAGE_TILES_CLASS, StatsLine } from "../_components/stats-tiles";

const PERCENT = 100;

function getLevelShare(level: BeltLevelDetails): number {
  return level.isMaxLevel ? 1 : level.progressInLevel / level.bpPerLevel;
}

/** Brain Power's violet: a belt's own color (yellow, white) barely shows against the track. */
function LevelBar({ level }: { level: BeltLevelDetails }) {
  return (
    <span aria-hidden="true" className="bg-surface-3 mt-1 flex h-1 overflow-hidden rounded-[2px]">
      <span
        className="bg-brain h-full rounded-[2px]"
        style={{ width: `${getLevelShare(level) * PERCENT}%` }}
      />
    </span>
  );
}

const DASH = "–";

/** After a belt's tenth level the next is the next belt's first, so the tile names that belt. */
async function NextLevelTile({ level }: { level: BeltLevelDetails }) {
  const t = await getExtracted();
  const format = await getFormatter();

  if (level.isMaxLevel) {
    return (
      <StatTile
        detail={t("Max level reached")}
        icon={<ChevronsUpIcon />}
        label={t("Next level")}
        value={DASH}
      />
    );
  }

  const label =
    level.nextBelt && level.level === LEVELS_PER_COLOR
      ? t(
          "{color, select, yellow {To Yellow belt} orange {To Orange belt} green {To Green belt} blue {To Blue belt} purple {To Purple belt} brown {To Brown belt} red {To Red belt} gray {To Gray belt} black {To Black belt} other {To the next belt}}",
          { color: level.nextBelt.color },
        )
      : t("To level {level}", { level: String(level.level + 1) });

  return (
    <StatTile
      detail={<LevelBar level={level} />}
      icon={<ChevronsUpIcon />}
      label={label}
      value={
        <>
          {formatWholeNumber({ format, value: level.bpToNextLevel })}{" "}
          <span className="text-muted-foreground font-sans text-xs font-normal tracking-normal">
            {t("Brain Power")}
          </span>
        </>
      }
    />
  );
}

export async function LevelTiles({ level }: { level: BeltLevelDetails }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const belt = await getBeltLabel({ color: level.color });

  return (
    <StatTiles className={STAT_PAGE_TILES_CLASS}>
      <StatTile
        detail={belt}
        icon={<BeltIndicator aria-hidden color={level.color} label={belt} size="sm" />}
        label={t("Level")}
        value={String(level.level)}
      />
      <StatTile
        detail={t("Never goes down")}
        icon={<BrainIcon />}
        label={t("Brain Power")}
        tone="brain"
        value={formatWholeNumber({ format, value: level.totalBrainPower })}
      />
      <NextLevelTile level={level} />
    </StatTiles>
  );
}

export async function LevelLine() {
  const t = await getExtracted();

  return (
    <StatsLine>
      {t("Every lesson adds {points} Brain Power, and it never goes down.", {
        points: String(BRAIN_POWER_PER_LESSON),
      })}
    </StatsLine>
  );
}
