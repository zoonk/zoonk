import { cn } from "@zoonk/ui/lib/utils";

/**
 * A short row of facts about one thing ("45 perguntas", "2h 45min"), each with its icon, instead of
 * label/value text pairs. A list, so screen readers count the facts.
 */
export function FactChips({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-wrap gap-2", className)} data-slot="fact-chips" {...props} />;
}

/** One fact: an icon (decorative, `aria-hidden`) and a few words. */
export function FactChip({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "bg-muted text-foreground [&>svg]:text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium tabular-nums [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="fact-chip"
      {...props}
    />
  );
}
