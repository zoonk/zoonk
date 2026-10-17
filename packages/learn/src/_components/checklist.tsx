"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { DoneMark } from "./status-mark";

/** The tick, on the label's first line when a long item wraps. */
function CheckMark({ checked }: { checked: boolean }) {
  return (
    <LineMarker aria-hidden="true">
      <span className="flex size-4 items-center justify-center">
        {checked ? (
          <DoneMark />
        ) : (
          <span className="ring-foreground/30 size-2.5 rounded-full ring-[1.5px] ring-inset" />
        )}
      </span>
    </LineMarker>
  );
}

/**
 * A routine to tick off on the device, such as exam day's, as flat rows: a ring to tick, then the
 * done mark and a quiet line once ticked. It's a calm reminder, never a test, so nothing is saved
 * and nothing waits for it.
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
        <h2 className="text-label" id={titleId}>
          {title}
        </h2>
        <span className="text-muted-foreground font-mono text-xs tabular-nums" aria-live="polite">
          {t("{done} of {total}", { done: String(done.size), total: String(items.length) })}
        </span>
      </div>

      <ul className={cn("flex flex-col [&>li+li]:border-t", listClassName)}>
        {items.map((item) => {
          const checked = done.has(item);

          return (
            <li key={item}>
              <button
                aria-pressed={checked}
                className={cn(
                  "focus-visible:ring-ring/50 hover:before:bg-muted/70 relative isolate flex min-h-11 w-full items-start gap-3 py-2.75 text-left text-sm outline-none before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-[0.625rem] focus-visible:ring-[3px]",
                  checked && "text-muted-foreground",
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
