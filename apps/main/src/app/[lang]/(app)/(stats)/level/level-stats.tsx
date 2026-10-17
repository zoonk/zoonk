import { getBeltLabel } from "@/lib/belt-colors";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { formatWholeNumber } from "@zoonk/utils/number";
import { BrainIcon, ChevronsUpIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { STAT_PAGE_TILES_CLASS, StatsLine } from "../_components/stats-tiles";

const PERCENT = 100;

/** How far into the current level the learner is, as a share of the level's Brain Power. */
function getLevelShare(level: BeltLevelDetails): number {
  return level.isMaxLevel ? 1 : level.progressInLevel / level.bpPerLevel;
}

/**
 * How far the next level is, as a thin bar in Brain Power's violet: the level counts Brain Power,
 * and a belt's own color (yellow, white) barely shows against the track.
 */
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

/** A value there isn't: past the last level, nothing is left to earn. */
const DASH = "–";

/**
 * How much more Brain Power the next level takes, its bar showing how far into this one the
 * learner is; at the last level, that it's reached.
 */
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

  return (
    <StatTile
      detail={<LevelBar level={level} />}
      icon={<ChevronsUpIcon />}
      label={t("To level {level}", { level: String(level.level + 1) })}
      value={
        <>
          {formatWholeNumber({ format, value: level.bpToNextLevel })}{" "}
          {/* What the number counts, quiet beside it, as the tile beside it names Brain Power. */}
          <span className="text-muted-foreground font-sans text-xs font-normal tracking-normal">
            {t("Brain Power")}
          </span>
        </>
      }
    />
  );
}

/**
 * Level's three numbers: the level in its belt, the Brain Power behind it, and how much more the
 * next level takes.
 */
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

/** One line under the belts: how Brain Power grows. */
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
