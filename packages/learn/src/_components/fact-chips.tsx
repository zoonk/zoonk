import { cn } from "@zoonk/ui/lib/utils";

export function FactChips({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-wrap gap-2", className)} data-slot="fact-chips" {...props} />;
}

const FACT_CHIP_CLASS =
  "text-muted-foreground ring-input inline-flex h-5.5 items-center gap-1 rounded-md px-2 text-[0.71875rem] font-medium tabular-nums ring-1 ring-inset [&>svg]:size-3 [&>svg]:shrink-0";

export function FactChip({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn(FACT_CHIP_CLASS, className)} data-slot="fact-chip" {...props} />;
}
