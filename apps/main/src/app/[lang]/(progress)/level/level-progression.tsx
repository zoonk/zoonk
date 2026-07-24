import { getBeltColors } from "@/lib/belt-colors";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BELT_COLORS_ORDER, type BeltLevelResult } from "@zoonk/utils/belt-level";
import { getExtracted } from "next-intl/server";

const BELT_PROGRESSION_TITLE_ID = "belt-progression-title";

type BeltOption = Awaited<ReturnType<typeof getBeltColors>>[number];

/**
 * Renders one semantic step in the belt journey so the parent remains a simple
 * mapping from the shared belt order to its visual state.
 */
function BeltStep({ belt, isCurrent }: { belt: BeltOption; isCurrent: boolean }) {
  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className="relative z-10 flex flex-1 justify-center"
    >
      <span
        className={cn(
          "bg-background flex size-6 items-center justify-center rounded-full",
          isCurrent && "ring-primary ring-2",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-3.5 rounded-full ring-1 ring-black/10 transition-all ring-inset dark:ring-white/10",
            belt.bgClass,
            isCurrent && "size-4",
          )}
        />
        <span className="sr-only">{belt.label}</span>
      </span>
    </li>
  );
}

/**
 * Shows the full belt journey as one compact landmark without competing with
 * the current-level progress bar in the page hero.
 */
export async function LevelProgression({ currentBelt }: { currentBelt: BeltLevelResult }) {
  const t = await getExtracted();
  const beltColors = await getBeltColors();
  const currentIndex = BELT_COLORS_ORDER.indexOf(currentBelt.color);
  const firstBelt = beltColors[0];
  const lastBelt = beltColors.at(-1);

  return (
    <section aria-labelledby={BELT_PROGRESSION_TITLE_ID} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium" id={BELT_PROGRESSION_TITLE_ID}>
        {t("Belt Progression")}
      </h2>

      <div className="relative">
        <span
          aria-hidden
          className="bg-border absolute top-1/2 right-3 left-3 h-px -translate-y-1/2"
        />
        <ol className="relative flex" aria-labelledby={BELT_PROGRESSION_TITLE_ID}>
          {beltColors.map((belt, index) => (
            <BeltStep belt={belt} isCurrent={index === currentIndex} key={belt.key} />
          ))}
        </ol>
      </div>

      {firstBelt && lastBelt && (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{firstBelt.label}</span>
          <span>{lastBelt.label}</span>
        </div>
      )}
    </section>
  );
}

/** Mirrors the compact belt journey while its translated labels are loading. */
export function LevelProgressionSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-32" />
      <div className="flex justify-between">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton
            className="size-4 rounded-full"
            // eslint-disable-next-line react/no-array-index-key -- static skeleton
            key={index}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
