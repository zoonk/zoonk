import { BELT_BG_CLASSES, getBeltLabel } from "@/lib/belt-colors";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
} from "@zoonk/ui/components/progress";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
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

/** Leads with the learner's current belt, next milestone, and durable Brain Power total. */
export async function LevelStats({ currentBelt }: { currentBelt: BeltLevelDetails }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();

  const beltLabel = await getBeltLabel({ color: currentBelt.color });
  const formattedBpPerLevel = formatWholeNumber({ format, value: currentBelt.bpPerLevel });
  const formattedBpToNext = formatWholeNumber({ format, value: currentBelt.bpToNextLevel });
  const formattedProgress = formatWholeNumber({ format, value: currentBelt.progressInLevel });
  const formattedTotalBp = formatWholeNumber({ format, value: currentBelt.totalBrainPower });
  const progressPercentage = getLevelProgressPercentage(currentBelt);

  return (
    <div className="flex flex-col gap-6">
      <ProgressHeadline>
        <div className="flex items-center gap-3">
          <BeltIndicator aria-hidden color={currentBelt.color} label={beltLabel} size="lg" />
          <ProgressHeadlineValue className="text-3xl sm:text-4xl">
            {t("{belt} · Level {level}", { belt: beltLabel, level: String(currentBelt.level) })}
          </ProgressHeadlineValue>
        </div>
      </ProgressHeadline>

      <ProgressRoot className="gap-y-2" locale={locale} value={progressPercentage}>
        <ProgressLabel>
          {currentBelt.isMaxLevel
            ? t("Max level reached")
            : t("{value} BP to next level", { value: formattedBpToNext })}
        </ProgressLabel>
        {currentBelt.isMaxLevel ? (
          <span className="text-muted-foreground ml-auto text-sm">{t("Complete")}</span>
        ) : (
          <span className="text-muted-foreground ml-auto text-sm tabular-nums">
            {t("{current} of {total} BP", {
              current: formattedProgress,
              total: formattedBpPerLevel,
            })}
          </span>
        )}
        <ProgressTrack className="h-2">
          <ProgressIndicator
            className={cn(
              BELT_BG_CLASSES[currentBelt.color],
              currentBelt.color === "white" && "ring-border ring-1 ring-inset dark:ring-0",
              currentBelt.color === "black" && "dark:ring-1 dark:ring-white/20 dark:ring-inset",
            )}
          />
        </ProgressTrack>
      </ProgressRoot>

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground text-sm">{t("Total Brain Power")}</span>
        <span className="font-medium tabular-nums">
          {t("{value} BP", { value: formattedTotalBp })}
        </span>
      </div>
    </div>
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
        <div className="flex justify-between gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="flex justify-between gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}
