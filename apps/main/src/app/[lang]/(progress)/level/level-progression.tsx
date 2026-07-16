import { BELT_BG_CLASSES, getBeltColors } from "@/lib/belt-colors";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BELT_COLORS_ORDER, type BeltLevelResult } from "@zoonk/utils/belt-level";
import { formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";

export async function LevelProgression({ currentBelt }: { currentBelt: BeltLevelResult }) {
  const t = await getExtracted();
  const format = await getFormatter();

  const beltColors = await getBeltColors();
  const currentIndex = BELT_COLORS_ORDER.indexOf(currentBelt.color);
  const beltLabel = beltColors[currentIndex]?.label ?? currentBelt.color;
  const formattedBpToNext = formatWholeNumber({ format, value: currentBelt.bpToNextLevel });

  const progressLabel = currentBelt.isMaxLevel
    ? t("{belt}, Level {level} of 10. Maximum level achieved.", {
        belt: beltLabel,
        level: String(currentBelt.level),
      })
    : t("{belt}, Level {level} of 10. {bp} Brain Power until next level.", {
        belt: beltLabel,
        bp: formattedBpToNext,
        level: String(currentBelt.level),
      });

  const progressPercentage = (currentBelt.level / 10) * 100;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{t("Belt Progression")}</h3>

      <div
        aria-label={progressLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={currentIndex * 10 + currentBelt.level}
        className="flex flex-col gap-3"
        role="progressbar"
      >
        <div className="flex items-start justify-between gap-2">
          {beltColors.map((belt, index) => {
            const isPast = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isFuture = index > currentIndex;

            return (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" key={belt.key}>
                <div className="flex h-6 items-center justify-center">
                  <div
                    aria-hidden
                    className={cn(
                      "size-3.5 rounded-full transition-all",
                      "ring-1 ring-black/10 ring-inset dark:ring-white/10",
                      belt.bgClass,
                      isPast && "opacity-50",
                      isCurrent && "ring-primary size-5 ring-2",
                      isFuture && "opacity-25",
                    )}
                    title={belt.label}
                  />
                </div>

                {isCurrent && (
                  <span className="text-foreground text-xs font-medium tabular-nums">
                    {t("{current}/10", { current: String(currentBelt.level) })}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {!currentBelt.isMaxLevel && (
          <div className="flex flex-col gap-1">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full transition-all",
                  BELT_BG_CLASSES[currentBelt.color],
                  currentBelt.color === "white" && "ring-border ring-1 ring-inset dark:ring-0",
                  currentBelt.color === "black" && "dark:ring-1 dark:ring-white/20 dark:ring-inset",
                )}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-muted-foreground text-xs">
              {t("{belt}: Level {current} of 10", {
                belt: beltLabel,
                current: String(currentBelt.level),
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function LevelProgressionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-32" />

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          {Array.from({ length: 10 }).map((_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- static skeleton
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" key={index}>
              <div className="flex h-6 items-center justify-center">
                <Skeleton className="size-3.5 rounded-full" />
              </div>
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </div>
  );
}
