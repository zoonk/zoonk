import { type BeltColorOption, getBeltColors, getBeltLabel } from "@/lib/belt-colors";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import { DoneMark } from "@zoonk/learn/status-mark";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BELT_COLORS_ORDER, type BeltColor, LEVELS_PER_COLOR } from "@zoonk/utils/belt-level";
import { formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { BeltRack } from "./belt-rack";

const PERCENT = 100;

const LIGHT_BELTS = new Set<BeltColor>(["white", "yellow", "orange", "green"]);

function renderNumber(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium tabular-nums">{chunks}</span>;
}

function Stitching({ className }: { className: string }) {
  return (
    <>
      <span className={cn("absolute top-[27%] border-t border-dashed", className)} />
      <span className={cn("absolute bottom-[27%] border-t border-dashed", className)} />
    </>
  );
}

function RankStripe({ isReached, share }: { isReached: boolean; share?: number }) {
  return (
    <span className="flex h-8 w-full py-[2.5px] md:h-11">
      <span
        className={cn(
          "relative flex-1 overflow-hidden rounded-xs",
          isReached && "bg-white",
          !isReached && "bg-black/50 ring-1 ring-inset",
          !isReached && (share === undefined ? "ring-white/15" : "ring-white/35"),
        )}
      >
        {share !== undefined && (
          <span
            className="bg-brain absolute inset-x-0 bottom-0"
            style={{ height: `${share * PERCENT}%` }}
          />
        )}
      </span>
    </span>
  );
}

/** Decorative: the words above it name the belt and its number. */
function BeltDrawing({
  belt,
  className,
  level,
  share,
}: {
  belt: BeltColorOption;
  className?: string;
  level: number;
  share?: number;
}) {
  const band = cn(
    "relative h-8 border-y border-transparent md:h-11",
    belt.bgClass,
    belt.key === "white" && "border-foreground/40",
    // The dark theme lightens Black's token so a small dot shows on the page; drawn this big, a
    // lightened black belt reads as the gray one, so it stays black.
    belt.key === "black" && "bg-black dark:border-white/35",
  );

  const stitch = LIGHT_BELTS.has(belt.key) ? "border-black/15" : "border-white/25";

  return (
    <div
      aria-hidden="true"
      className={cn("grid grid-cols-[36fr_52fr_12fr] md:grid-cols-[60fr_27fr_13fr]", className)}
    >
      <span className={cn(band, "col-start-1 row-start-1")}>
        <Stitching className={cn("right-2 left-0", stitch)} />
      </span>

      <span
        className={cn(
          "col-start-2 row-start-1",
          belt.key === "black" ? "bg-red-700" : "bg-neutral-950",
        )}
      />

      <span className={cn(band, "col-start-3 row-start-1 rounded-r-md border-r")}>
        <Stitching className={cn("right-2.5 left-2", stitch)} />
      </span>

      <span className="col-start-2 row-span-2 row-start-1 flex justify-between px-2.5 md:px-4">
        {Array.from({ length: LEVELS_PER_COLOR }, (_, index) => (
          <span className="flex w-1 flex-col items-center gap-1 md:w-1.5" key={index}>
            <RankStripe isReached={index < level} share={index === level ? share : undefined} />
            <span
              className={cn(
                "text-2xs font-mono leading-none",
                index + 1 === level ? "text-foreground font-semibold" : "text-faint",
              )}
            >
              {index + 1}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

/** After a belt's tenth number comes the next belt, so the line names that belt alone. */
async function NextStep({
  level,
  nextBelt,
}: {
  level: BeltLevelDetails;
  nextBelt?: BeltColorOption;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const belt = await getBeltLabel({ color: level.color });

  if (level.isMaxLevel) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <DoneMark />
        {t("Every belt earned")}
      </p>
    );
  }

  const points = formatWholeNumber({ format, value: level.bpToNextLevel });

  return (
    <p className="text-muted-foreground text-sm">
      {nextBelt && level.level === LEVELS_PER_COLOR
        ? t.rich("<mono>{points}</mono> Brain Power to {belt}", {
            belt: nextBelt.label,
            mono: renderNumber,
            points,
          })
        : t.rich({
            description:
              'The points still needed for the belt\'s next number. {belt} {level} is a belt and its number from 1 to 10, such as "White belt 4".',
            message: "<mono>{points}</mono> Brain Power to {belt} {level}",
            values: { belt, level: String(level.level + 1), mono: renderNumber, points },
          })}
    </p>
  );
}

export async function LevelProgression({ currentBelt }: { currentBelt: BeltLevelDetails }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const beltColors = await getBeltColors();
  const currentIndex = BELT_COLORS_ORDER.indexOf(currentBelt.color);
  const belt = beltColors[currentIndex];

  if (!belt) {
    return null;
  }

  const nextBelt = beltColors.find((option) => option.key === currentBelt.nextBelt?.color);
  // White and black would wash the panel white or gray; their panel stays neutral.
  const isNeutral = belt.key === "white" || belt.key === "black";
  // On a belt's tenth number the panel already names the next belt.
  const namesNextBelt = currentBelt.level < LEVELS_PER_COLOR;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl p-4 md:px-6 md:pt-5 md:pb-4",
          isNeutral ? "bg-muted" : "bg-card",
        )}
      >
        {!isNeutral && (
          <span aria-hidden="true" className={cn("absolute inset-0 opacity-10", belt.bgClass)} />
        )}

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-lg font-semibold tracking-tight">
              {t({
                description:
                  'A belt and its number from 1 to 10, such as "White belt 4". {belt} is the belt\'s name, such as "White belt".',
                message: "{belt} {level}",
                values: { belt: belt.label, level: String(currentBelt.level) },
              })}
            </p>

            <p className="text-brain-text text-sm font-medium tabular-nums">
              {t("{points} Brain Power", {
                points: formatWholeNumber({ format, value: currentBelt.totalBrainPower }),
              })}
            </p>
          </div>

          <BeltDrawing
            belt={belt}
            className="-ml-4 md:-ml-6"
            level={currentBelt.level}
            share={
              currentBelt.isMaxLevel
                ? undefined
                : currentBelt.progressInLevel / currentBelt.bpPerLevel
            }
          />

          <NextStep level={currentBelt} nextBelt={nextBelt} />
        </div>
      </div>

      <BeltRack beltColors={beltColors} currentIndex={currentIndex} />

      {currentBelt.nextBelt && nextBelt && namesNextBelt && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <LineMarker>
            <BeltIndicator aria-hidden color={nextBelt.key} label={nextBelt.label} size="sm" />
          </LineMarker>
          <span className="text-pretty">
            {t.rich({
              description:
                '{next} and {belt} are belt names, such as "Yellow belt" and "White belt". {count} is a belt\'s last number, 10.',
              message: "{next} comes after {belt} {count}, at <mono>{points}</mono> Brain Power",
              values: {
                belt: belt.label,
                count: String(LEVELS_PER_COLOR),
                mono: renderNumber,
                next: nextBelt.label,
                points: formatWholeNumber({ format, value: currentBelt.nextBelt.startBrainPower }),
              },
            })}
          </span>
        </p>
      )}
    </div>
  );
}

export function LevelProgressionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-36 w-full rounded-xl md:h-36" />
      <div className="flex justify-between">
        {BELT_COLORS_ORDER.map((color) => (
          <Skeleton className="h-6.5 w-8 rounded-md md:h-9.5 md:w-13" key={color} />
        ))}
      </div>
    </div>
  );
}
