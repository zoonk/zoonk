import { getBeltColors } from "@/lib/belt-colors";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BELT_COLORS_ORDER, type BeltColor, type BeltLevelResult } from "@zoonk/utils/belt-level";
import { getExtracted } from "next-intl/server";

const BELT_PROGRESSION_TITLE_ID = "belt-progression-title";

type BeltOption = Awaited<ReturnType<typeof getBeltColors>>[number];

/**
 * One belt on the path: its dot in its color, reached or still ahead (the current one ringed and a
 * little larger), and from a tablet up its color's name under it (`shortName`, "Yellow"), quiet
 * unless it's the learner's.
 */
function BeltStep({
  belt,
  isCurrent,
  shortName,
}: {
  belt: BeltOption;
  isCurrent: boolean;
  shortName: string;
}) {
  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className="relative z-10 flex flex-1 flex-col items-center gap-2"
    >
      <span
        className={cn(
          "bg-background flex size-6 items-center justify-center rounded-full",
          isCurrent && "ring-foreground ring-[1.5px]",
        )}
      >
        <span
          aria-label={belt.label}
          className={cn(
            // The firmer edge keeps a white belt from vanishing on the page.
            "ring-foreground/60 size-3.5 rounded-full ring-[1.5px] ring-inset",
            belt.bgClass,
            isCurrent && "size-4",
          )}
          role="img"
        />
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "hidden max-w-full truncate text-[0.71875rem] md:block",
          isCurrent ? "text-foreground font-medium" : "text-faint",
        )}
      >
        {shortName}
      </span>
    </li>
  );
}

/**
 * Every belt as one path across the page in its own color, the learner's ringed, each named from a tablet up (on a
 * phone the first and last are named under the path).
 */
export async function LevelProgression({ currentBelt }: { currentBelt: BeltLevelResult }) {
  const t = await getExtracted();
  const beltColors = await getBeltColors();
  const currentIndex = BELT_COLORS_ORDER.indexOf(currentBelt.color);
  const firstBelt = beltColors[0];
  const lastBelt = beltColors.at(-1);

  // Under its dot a belt is its color alone: the section already says they're belts.
  const shortName = (color: BeltColor) =>
    t(
      "{color, select, white {White} yellow {Yellow} orange {Orange} green {Green} blue {Blue} purple {Purple} brown {Brown} red {Red} gray {Gray} black {Black} other {Belt}}",
      { color },
    );

  return (
    <section aria-labelledby={BELT_PROGRESSION_TITLE_ID} className="flex flex-col gap-4">
      <h2 className="text-label" id={BELT_PROGRESSION_TITLE_ID}>
        {t("Belt progression")}
      </h2>

      <div className="relative">
        <span aria-hidden className="bg-border absolute top-3 right-3 left-3 h-px" />
        <ol className="relative flex" aria-labelledby={BELT_PROGRESSION_TITLE_ID}>
          {beltColors.map((belt, index) => (
            <BeltStep
              belt={belt}
              isCurrent={index === currentIndex}
              key={belt.key}
              shortName={shortName(belt.key)}
            />
          ))}
        </ol>
      </div>

      {firstBelt && lastBelt && (
        <div
          aria-hidden="true"
          className="text-faint flex justify-between text-[0.71875rem] md:hidden"
        >
          <span>{firstBelt.label}</span>
          <span>{lastBelt.label}</span>
        </div>
      )}
    </section>
  );
}

/** The belt path at its size while its labels load. */
export function LevelProgressionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-3.5 w-32" />
      <div className="flex justify-between">
        {BELT_COLORS_ORDER.map((color) => (
          <Skeleton className="size-6 rounded-full" key={color} />
        ))}
      </div>
      <Skeleton className="h-3 w-full md:h-4" />
    </div>
  );
}
