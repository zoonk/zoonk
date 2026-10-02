"use client";

import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { useBeltName } from "../_utils/use-belt-name";

const STRIPES_PER_BELT = 10;

/** New stripes light one after another, a beat apart. */
const STRIPE_DELAY_MS = 150;

/**
 * A belt's ten levels as stripes. The ones earned in this session light up one after another at
 * the end of it (all at once under reduced motion); a new belt color starts over.
 */
export function BeltStripes({
  color,
  level,
  stripesGained,
}: {
  color: BeltColor;
  level: number;
  stripesGained: number;
}) {
  const t = useExtracted();
  const beltName = useBeltName();
  const firstNew = level - stripesGained;
  const beltLevel = t("{belt}, level {level}", { belt: beltName(color), level: String(level) });

  return (
    <div className="flex flex-col gap-2" data-slot="belt-stripes">
      <div
        aria-hidden="true"
        className="border-border bg-muted flex h-9 items-center gap-1 overflow-hidden rounded-xl border p-1"
      >
        {Array.from({ length: STRIPES_PER_BELT }, (_, index) => {
          const isLit = index < level;
          const isNew = isLit && index >= firstNew;

          return (
            <span
              aria-hidden="true"
              className={cn(
                "h-full flex-1 rounded-sm",
                isLit ? beltColorClasses[color] : "bg-foreground/10",
                isNew && "in-data-[mode=fun]:animate-fun-ceremony",
              )}
              key={index}
              style={
                isNew ? { animationDelay: `${(index - firstNew) * STRIPE_DELAY_MS}ms` } : undefined
              }
            />
          );
        })}
      </div>

      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{beltLevel}</span>
        {stripesGained > 0 && (
          <span className="in-data-[mode=fun]:text-fun-accent-lime font-semibold" role="status">
            {t("{count, plural, one {+# stripe} other {+# stripes}}", { count: stripesGained })}
          </span>
        )}
      </p>
    </div>
  );
}
