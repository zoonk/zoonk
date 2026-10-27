import { type BeltColorOption, getBeltColors } from "@/lib/belt-colors";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import { PageSectionTitle } from "@zoonk/learn/page";
import { DoneMark } from "@zoonk/learn/status-mark";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BELT_COLORS_ORDER, type BeltColor, LEVELS_PER_COLOR } from "@zoonk/utils/belt-level";
import { formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { BeltRack } from "./belt-rack";

const BELT_PROGRESSION_TITLE_ID = "belt-progression-title";
const PERCENT = 100;

/** Belts light enough for dark stitching; the darker ones get light stitching. */
const LIGHT_BELTS = new Set<BeltColor>(["white", "yellow", "orange", "green"]);

/** A number inside the belt's sentences ("Level 2 of 10", "at 7,500 Brain Power"), firmer. */
function renderNumber(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium tabular-nums">{chunks}</span>;
}

/** The belt's two rows of stitching, dashed across one piece of it. */
function Stitching({ className }: { className: string }) {
  return (
    <>
      <span className={cn("absolute top-[27%] border-t border-dashed", className)} />
      <span className={cn("absolute bottom-[27%] border-t border-dashed", className)} />
    </>
  );
}

/**
 * One stripe on the rank bar: white tape once its level is reached, the next one an empty slot
 * filling with Brain Power's violet (`share` of the level), the rest empty slots. Tape and slots sit
 * inside the bar alike, so the bar frames every stripe instead of the tape reaching the panel.
 */
function RankStripe({ isReached, share }: { isReached: boolean; share?: number }) {
  return (
    <span className="flex h-8 w-full py-[2.5px] md:h-11">
      <span
        className={cn(
          "relative flex-1 overflow-hidden rounded-[1px]",
          isReached && "bg-white",
          // A dark inside keeps a slot reading as empty on Black's red bar.
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

/**
 * The learner's belt as an object, a close-up of its end: the band in its color with two rows of
 * stitching, and the dark rank bar where each level reached is a stripe of white tape, numbered
 * under the bar. Black's bar is red, as on a real black belt. It starts at the panel's edge, as if
 * the rest of the belt ran past it. Decorative: the words above it name the belt and level.
 */
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
    // White would vanish into a light panel and Black into a dark one without an edge. It runs
    // along the belt and around its end, never across the panel's edge, where the belt runs on.
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
                "font-mono text-[0.625rem] leading-none",
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

/**
 * What the next belt takes: its name and the Brain Power where it starts, and how much more that
 * is; on Black, that every belt is earned.
 */
async function NextBelt({
  className,
  level,
  nextBelt,
}: {
  className?: string;
  level: BeltLevelDetails;
  nextBelt?: BeltColorOption;
}) {
  const t = await getExtracted();
  const format = await getFormatter();

  if (!(level.nextBelt && nextBelt)) {
    return (
      <p className={cn("flex items-center gap-1.5 text-sm font-medium", className)}>
        <DoneMark />
        {t("Every belt earned")}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-label">{t("Next belt")}</p>

      <p className="flex items-center gap-2 text-sm font-medium">
        <BeltIndicator aria-hidden color={nextBelt.key} label={nextBelt.label} size="sm" />
        <span>
          {t.rich("{belt} at <mono>{points}</mono> Brain Power", {
            belt: nextBelt.label,
            mono: renderNumber,
            points: formatWholeNumber({ format, value: level.nextBelt.startBrainPower }),
          })}
        </span>
      </p>

      <p className="text-muted-foreground text-xs">
        {t.rich("{points, plural, one {<mono>#</mono> to go} other {<mono>#</mono> to go}}", {
          mono: renderNumber,
          points: level.nextBelt.brainPowerToGo,
        })}
      </p>
    </div>
  );
}

/**
 * The learner's belt drawn as a belt, its stripes counting the levels reached, beside what the next
 * belt takes; under it, every belt on a rack.
 */
export async function LevelProgression({ currentBelt }: { currentBelt: BeltLevelDetails }) {
  const t = await getExtracted();
  const beltColors = await getBeltColors();
  const currentIndex = BELT_COLORS_ORDER.indexOf(currentBelt.color);
  const belt = beltColors[currentIndex];

  if (!belt) {
    return null;
  }

  const nextBelt = beltColors.find((option) => option.key === currentBelt.nextBelt?.color);
  // White and black would wash the panel white or gray; their panel stays neutral.
  const isNeutral = belt.key === "white" || belt.key === "black";

  return (
    <section aria-labelledby={BELT_PROGRESSION_TITLE_ID} className="flex flex-col gap-4">
      <PageSectionTitle id={BELT_PROGRESSION_TITLE_ID}>{t("Belt progression")}</PageSectionTitle>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl p-4 md:px-6 md:pt-5 md:pb-4",
          isNeutral ? "bg-muted" : "bg-card",
        )}
      >
        {!isNeutral && (
          <span aria-hidden="true" className={cn("absolute inset-0 opacity-10", belt.bgClass)} />
        )}

        <div className="relative grid gap-x-6 gap-y-4 md:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-semibold tracking-tight">{belt.label}</p>
            <p className="text-muted-foreground text-sm">
              {t.rich("Level <mono>{level}</mono> of {count}", {
                count: String(LEVELS_PER_COLOR),
                level: String(currentBelt.level),
                mono: renderNumber,
              })}
            </p>
          </div>

          <BeltDrawing
            belt={belt}
            className="-ml-4 md:col-span-2 md:row-start-2 md:-ml-6"
            level={currentBelt.level}
            share={
              currentBelt.isMaxLevel
                ? undefined
                : currentBelt.progressInLevel / currentBelt.bpPerLevel
            }
          />

          <NextBelt
            className="md:col-start-2 md:row-start-1 md:items-end md:text-right"
            level={currentBelt}
            nextBelt={nextBelt}
          />
        </div>
      </div>

      <BeltRack
        beltColors={beltColors}
        currentIndex={currentIndex}
        labelledBy={BELT_PROGRESSION_TITLE_ID}
      />
    </section>
  );
}

/** The belt section at its size while its labels load. */
export function LevelProgressionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-44 w-full rounded-xl md:h-36" />
      <div className="flex justify-between">
        {BELT_COLORS_ORDER.map((color) => (
          <Skeleton className="h-6.5 w-8 rounded-md md:h-9.5 md:w-13" key={color} />
        ))}
      </div>
    </div>
  );
}
