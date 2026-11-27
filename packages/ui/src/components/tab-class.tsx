import { cn } from "@zoonk/ui/lib/utils";

/**
 * A tab and its current look, the same in every app (craft X2): the navigation's `muted` fill.
 * A link in a row of section links marks itself with `aria-current`, a `TabsTrigger` with
 * `data-active`, a radio's label with its checked input. No client code here, so a server
 * component can draw the look too. A tab or a link pressed before the page hydrates (`data-held`)
 * takes the look at once.
 */
export const TAB_LIST_CLASS =
  "flex gap-0.5 [&:has([data-held])_[data-active]]:bg-transparent [&:has([data-held])_[data-active]]:text-muted-foreground [&:has([data-held])_[aria-current=page]:not([data-held])]:bg-transparent [&:has([data-held])_[aria-current=page]:not([data-held])]:text-muted-foreground";

export const TAB_CLASS = cn(
  "text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground data-active:bg-muted data-active:text-foreground data-held:bg-muted data-held:text-foreground has-checked:bg-muted has-checked:text-foreground focus-visible:ring-ring/50 has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
  "hit-area text-compact relative flex h-7.5 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

/**
 * The same tabs as a column, where there's room beside what they switch: each a row with how many
 * things it lists at its end (`TAB_ROW_COUNT_CLASS`).
 */
export const TAB_ROW_CLASS = cn(TAB_CLASS, "h-8 gap-2.5");

export const TAB_ROW_COUNT_CLASS =
  "text-muted-foreground ml-auto pl-3 font-mono text-xs tabular-nums";

/**
 * A row of tabs that scrolls sideways: a tab's fill starts 10 px before its label, so the row
 * starts that much early and the labels start on the column, and on a phone it runs to the screen's edges.
 */
export const TAB_SCROLL_ROW_CLASS =
  "-mx-4 [--scroll-inset:--spacing(1.5)] sm:-mx-2.5 sm:[--scroll-inset:0px]";
