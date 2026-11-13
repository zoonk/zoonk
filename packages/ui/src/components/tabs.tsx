"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@zoonk/ui/lib/utils";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      className={cn("flex gap-2 data-[orientation=horizontal]:flex-col", className)}
      data-orientation={orientation}
      data-slot="tabs"
      {...props}
    />
  );
}

/**
 * A tab and its current look, the same in every app (craft X2): the navigation's `muted` fill.
 * A link in a row of section links marks itself with `aria-current`, a `TabsTrigger` with
 * `data-active`.
 */
const TAB_LIST_CLASS = "flex gap-0.5";

const TAB_CLASS = cn(
  "text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground data-active:bg-muted data-active:text-foreground focus-visible:ring-ring/50",
  "hit-area text-compact relative flex h-7.5 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn(TAB_LIST_CLASS, className)}
      data-slot="tabs-list"
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab className={cn(TAB_CLASS, className)} data-slot="tabs-trigger" {...props} />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn(
        "focus-visible:ring-ring/50 flex-1 rounded-lg text-sm outline-none focus-visible:ring-[3px]",
        className,
      )}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { TAB_CLASS, TAB_LIST_CLASS, Tabs, TabsContent, TabsList, TabsTrigger };
