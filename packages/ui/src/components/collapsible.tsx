"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none",
        className,
      )}
      data-slot="collapsible-content"
      {...props}
    />
  );
}

/**
 * The glyph of anything that folds. It turns by itself inside a `CollapsibleTrigger`, a control
 * with `aria-expanded` or the `summary` of an open `details`. At a row's end it takes the tone of a
 * list row's chevron; `inline`, after a label's words, it takes the label's color.
 */
function FoldChevron({ className, inline = false }: { className?: string; inline?: boolean }) {
  return (
    <ChevronDownIcon
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 self-center transition-transform in-aria-expanded:rotate-180 in-data-panel-open:rotate-180 motion-reduce:transition-none [details[open]>summary_&]:rotate-180",
        !inline && "text-faint edge ms-(--edge-pull) -me-(--edge-pull)",
        className,
      )}
      data-slot="fold-chevron"
    />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger, FoldChevron };
