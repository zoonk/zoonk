"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";

/** "# more …" after the rows a list shows first, which opens the rest under it. */
export function ShowMore({
  children,
  defaultOpen = false,
  label,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  label: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-10 items-center gap-1 rounded-lg text-sm font-medium outline-none focus-visible:ring-[3px]">
        {label}
        <FoldChevron inline />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
