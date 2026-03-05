"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";

export function StatsTitle({ title, help }: { title: string; help?: string }) {
  if (!help) {
    return <h3 className="text-sm leading-tight font-medium">{title}</h3>;
  }

  return (
    <Tooltip>
      <TooltipTrigger className="decoration-muted-foreground/50 cursor-help text-sm leading-tight font-medium decoration-dotted underline-offset-4 hover:underline">
        {title}
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  );
}
