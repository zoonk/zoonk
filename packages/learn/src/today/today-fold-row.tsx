"use client";

import { FoldChevron } from "@zoonk/ui/components/collapsible";
import { DoneMark } from "../_components/status-mark";

export function FoldRow({
  controls,
  done,
  label,
  onToggle,
  open,
}: {
  controls: string;
  done: boolean;
  label: string;
  onToggle: () => void;
  open: boolean;
}) {
  return (
    <button
      aria-controls={controls}
      aria-expanded={open}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mx-2.5 flex min-h-11 w-[calc(100%+1.25rem)] items-center gap-3 rounded-lg px-2.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
      onClick={onToggle}
      type="button"
    >
      <span aria-hidden="true" className="flex w-4 shrink-0 justify-center">
        {done && <DoneMark className="size-3.5" />}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
        {label}
        <FoldChevron inline />
      </span>
    </button>
  );
}
