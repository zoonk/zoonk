import { cn } from "@zoonk/ui/lib/utils";

/**
 * A tab and its current look, the same in every app (craft X2): the navigation's `muted` fill.
 * A link in a row of section links marks itself with `aria-current`, a `TabsTrigger` with
 * `data-active`, a radio's label with its checked input. No client code here, so a server
 * component can draw the look too.
 */
export const TAB_LIST_CLASS = "flex gap-0.5";

export const TAB_CLASS = cn(
  "text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground data-active:bg-muted data-active:text-foreground has-checked:bg-muted has-checked:text-foreground focus-visible:ring-ring/50 has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
  "hit-area text-compact relative flex h-7.5 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);
