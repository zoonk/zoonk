import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { MeterPart, MeterParts } from "./meter";

/** A belt has ten levels, each a tick. */
const LEVELS_PER_BELT = 10;

/** A level's tick in its belt's color; a white belt's would vanish on the page, so it's ink. */
function tickClass(color: BeltColor): string {
  return color === "white" ? "bg-foreground/70" : beltColorClasses[color];
}

/**
 * A belt's ten levels as a meter of parts (6px, 2px apart, as every meter), lit in its color up to
 * the level reached. The last `filling` of them (the level just reached) fill in over their track
 * after `delay`, where a celebration plays; otherwise every tick is simply lit. Decorative: the
 * words beside it name the level.
 */
export function BeltTicks({
  className,
  color,
  delay = 0,
  filling = 0,
  level,
}: {
  className?: string;
  color: BeltColor;
  delay?: number;
  filling?: number;
  level: number;
}) {
  return (
    <MeterParts as="span" className={className} data-slot="belt-ticks">
      {Array.from({ length: LEVELS_PER_BELT }, (_, index) => {
        const fills = index >= level - filling && index < level;

        return (
          <MeterPart
            as="span"
            className={cn(
              index < level && !fills && tickClass(color),
              fills && "relative overflow-hidden",
            )}
            // oxlint-disable-next-line react/no-array-index-key -- Ticks are the belt's levels, not items.
            key={index}
          >
            {fills && (
              <span
                className={cn("animate-fill absolute inset-0 origin-left", tickClass(color))}
                style={{ animationDelay: `${delay}ms` }}
              />
            )}
          </MeterPart>
        );
      })}
    </MeterParts>
  );
}
