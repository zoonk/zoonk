"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { TooltipKbd } from "@zoonk/ui/components/kbd";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { type ShortcutName } from "@zoonk/ui/lib/shortcuts";

/** The delay `Sidebar` gives its items' names, so every icon button names itself alike. */
const TOOLTIP_DELAY_MS = 400;

/** An icon button's name and its key, shown on hover: where an icon button shows its keycap. */
export function ShortcutTooltip({
  align = "center",
  children,
  label,
  shortcut,
  side = "bottom",
}: {
  align?: "start" | "center" | "end";
  children: React.ReactElement;
  label: React.ReactNode;
  shortcut: ShortcutName;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipProvider delay={TOOLTIP_DELAY_MS}>
      <TooltipPrimitive.Root>
        <TooltipTrigger render={children} />
        <TooltipContent align={align} side={side}>
          {label}
          <TooltipKbd shortcut={shortcut} />
        </TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}
