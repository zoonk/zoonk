import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { MeterPart, MeterParts } from "./meter";

const LEVELS_PER_BELT = 10;

/** A white tick would vanish on the page, so it's ink. */
function tickClass(color: BeltColor): string {
  return color === "white" ? "bg-foreground/70" : beltColorClasses[color];
}

export function BeltTicks({
  className,
  color,
  delayMs = 0,
  filling = 0,
  level,
}: {
  className?: string;
  color: BeltColor;
  delayMs?: number;
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
                style={{ animationDelay: `${delayMs}ms` }}
              />
            )}
          </MeterPart>
        );
      })}
    </MeterParts>
  );
}
