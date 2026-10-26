import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";

/** A belt has ten levels, each a tick. */
const LEVELS_PER_BELT = 10;

/** A level's tick in its belt's color; a white belt's would vanish on the page, so it's ink. */
function tickClass(color: BeltColor): string {
  return color === "white" ? "bg-foreground/70" : beltColorClasses[color];
}

/**
 * A belt's ten levels as ticks, lit in its color up to the level reached; the ones just `gained`
 * charge in, so the learner sees which are new. Decorative: the words beside it name the level.
 */
export function BeltTicks({
  className,
  color,
  gained,
  level,
}: {
  className?: string;
  color: BeltColor;
  gained: number;
  level: number;
}) {
  return (
    <span aria-hidden="true" className={cn("flex h-1 gap-[3px]", className)}>
      {Array.from({ length: LEVELS_PER_BELT }, (_, index) => (
        <span
          className={cn(
            "flex-1 rounded-xs",
            index < level ? tickClass(color) : "bg-surface-3",
            index >= level - gained &&
              index < level &&
              "motion-safe:animate-energy-charge origin-left",
          )}
          // oxlint-disable-next-line react/no-array-index-key -- Ticks are the belt's levels, not items.
          key={index}
        />
      ))}
    </span>
  );
}
