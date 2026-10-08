import { getBeltLabel } from "@/lib/belt-colors";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import { BeltIndicator, beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
} from "@zoonk/ui/components/progress";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { ProgressHeadline, ProgressHeadlineValue } from "../_components/progress-headline";

/**
 * Converts progress within the current level to the percentage expected by the
 * progress primitive while treating the final black-belt level as complete.
 */
function getLevelProgressPercentage(currentBelt: BeltLevelDetails): number {
  if (currentBelt.isMaxLevel) {
    return 100;
  }

  return (currentBelt.progressInLevel / currentBelt.bpPerLevel) * 100;
}

/** Leads with the learner's current belt and level, and how far the next level is. */
export async function LevelStats({ currentBelt }: { currentBelt: BeltLevelDetails }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();

  const beltLabel = await getBeltLabel({ color: currentBelt.color });
  const formattedBpToNext = formatWholeNumber({ format, value: currentBelt.bpToNextLevel });
  const progressPercentage = getLevelProgressPercentage(currentBelt);

  return (
    <div className="flex flex-col gap-6">
      <ProgressHeadline>
        <div className="flex items-start gap-3">
          {/* On the first line of the belt's name, which wraps in longer languages. */}
          <LineMarker className="text-3xl sm:text-4xl">
            <BeltIndicator aria-hidden color={currentBelt.color} label={beltLabel} size="lg" />
          </LineMarker>
          <ProgressHeadlineValue className="text-3xl text-balance sm:text-4xl">
            {t("{belt} · level {level}", { belt: beltLabel, level: String(currentBelt.level) })}
          </ProgressHeadlineValue>
        </div>
      </ProgressHeadline>

      <ProgressRoot className="gap-y-2" locale={locale} value={progressPercentage}>
        <ProgressLabel>
          {currentBelt.isMaxLevel
            ? t("Max level reached")
            : t("{value} Brain Power to the next level", { value: formattedBpToNext })}
        </ProgressLabel>
        <ProgressTrack className="h-2">
          <ProgressIndicator
            className={cn(
              beltColorClasses[currentBelt.color],
              currentBelt.color === "white" && "ring-border ring-1 ring-inset dark:ring-0",
              currentBelt.color === "black" && "dark:ring-1 dark:ring-white/20 dark:ring-inset",
            )}
          />
        </ProgressTrack>
      </ProgressRoot>
    </div>
  );
}

/** One sentence under the belts: the Brain Power total, how it grows and that it never drops. */
export async function LevelLine({ totalBrainPower }: { totalBrainPower: number }) {
  const t = await getExtracted();
  const format = await getFormatter();

  return (
    <p className="text-muted-foreground text-sm">
      {t("You have {total} Brain Power. Every lesson adds {points}, and it never goes down.", {
        points: String(BRAIN_POWER_PER_LESSON),
        total: formatWholeNumber({ format, value: totalBrainPower }),
      })}
    </p>
  );
}

/** Mirrors the level hero's hierarchy while its progress data is loading. */
export function LevelStatsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ProgressHeadline>
        <div className="flex items-center gap-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-10 w-64 max-w-full" />
        </div>
      </ProgressHeadline>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}
