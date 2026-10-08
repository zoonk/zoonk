"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";

/** The tick, on the label's first line when a long item wraps. */
function CheckMark({ checked }: { checked: boolean }) {
  return (
    <LineMarker aria-hidden="true">
      <span
        className={cn(
          "border-border flex size-5 items-center justify-center rounded-full border",
          checked && "bg-foreground text-background border-transparent",
        )}
      >
        {checked && <CheckIcon className="size-3.5" />}
      </span>
    </LineMarker>
  );
}

/**
 * A routine to tick off on the device, such as exam day's: it's a calm reminder, never a test,
 * so nothing is saved and nothing waits for it.
 */
export function Checklist<Item extends string>({
  className,
  items,
  label,
  listClassName,
  title,
}: {
  className?: string;
  items: readonly Item[];
  label: (item: Item) => React.ReactNode;
  listClassName?: string;
  title: string;
}) {
  const t = useExtracted();
  const titleId = useId();
  const [done, setDone] = useState<ReadonlySet<Item>>(new Set());

  if (items.length === 0) {
    return null;
  }

  function toggle(item: Item) {
    setDone((current) => {
      const next = new Set(current);

      if (!next.delete(item)) {
        next.add(item);
      }

      return next;
    });
  }

  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold" id={titleId}>
          {title}
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
          {t("{done} of {total}", { done: String(done.size), total: String(items.length) })}
        </span>
      </div>

      <ul className={cn("flex flex-col gap-2", listClassName)}>
        {items.map((item) => {
          const checked = done.has(item);

          return (
            <li key={item}>
              <button
                aria-pressed={checked}
                className={cn(
                  "border-border focus-visible:ring-ring/50 flex min-h-11 w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left text-sm outline-none focus-visible:ring-[3px]",
                  checked && "border-foreground/40",
                )}
                onClick={() => toggle(item)}
                type="button"
              >
                <CheckMark checked={checked} />
                <span className="min-w-0">{label(item)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
