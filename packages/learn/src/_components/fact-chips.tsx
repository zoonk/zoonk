import { cn } from "@zoonk/ui/lib/utils";

/**
 * A short row of facts about one thing ("45 questions", "2h 45min"), each with its icon, instead of
 * label/value text pairs. A list, so screen readers count the facts.
 */
export function FactChips({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-wrap gap-2", className)} data-slot="fact-chips" {...props} />;
}

/** A chip's look: 22px, the stronger line. */
const FACT_CHIP_CLASS =
  "text-muted-foreground ring-input inline-flex h-5.5 items-center gap-1 rounded-md px-2 text-[0.71875rem] font-medium tabular-nums ring-1 ring-inset [&>svg]:size-3 [&>svg]:shrink-0";

/** One fact as a chip (22px, the stronger line): an icon (decorative, `aria-hidden`) and a few words. */
export function FactChip({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn(FACT_CHIP_CLASS, className)} data-slot="fact-chip" {...props} />;
}
