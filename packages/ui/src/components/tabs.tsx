"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
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

/** The row reaches 10px past the column like a highlighted row, so the first label starts on the title's edge. */
function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn(TAB_LIST_CLASS, "-mx-2.5", className)}
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

export { Tabs, TabsContent, TabsList, TabsTrigger };
