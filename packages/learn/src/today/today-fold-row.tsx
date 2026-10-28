"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { DoneMark } from "../_components/status-mark";
import { useFormatDuration } from "../_utils/time-format";
import { SESSION_LIST_ID } from "./today-ids";

/** Only time still ahead says its minutes: a done row's are the plan's estimate, not the time it took. */
export function FoldRow({
  className,
  done,
  label,
  minutes,
  onToggle,
  open,
}: {
  className?: string;
  done: boolean;
  label: string;
  minutes?: number;
  onToggle: () => void;
  open: boolean;
}) {
  const formatDuration = useFormatDuration();

  return (
    <div className={className}>
      <button
        aria-controls={SESSION_LIST_ID}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mx-2.5 flex min-h-11 w-[calc(100%+1.25rem)] items-center gap-3 rounded-[0.625rem] px-2.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
        onClick={onToggle}
        type="button"
      >
        <span aria-hidden="true" className="flex w-3 shrink-0 justify-center">
          {done && <DoneMark className="size-3.5" />}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
          {label}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
          />
        </span>
        {minutes ? (
          <span className="shrink-0 font-mono text-xs tabular-nums">{formatDuration(minutes)}</span>
        ) : null}
      </button>
    </div>
  );
}
