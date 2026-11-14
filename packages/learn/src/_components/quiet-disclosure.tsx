"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";

/** The look of a small text action under a line: "See all changes", or "Try again" in its place. */
export const QUIET_ACTION_CLASS =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 hit-area text-compact relative -mx-1 flex w-fit items-center gap-1 rounded-md px-1 leading-snug underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]";

/** A small text button that opens what most learners don't need: every change, a formula, a source. */
export function QuietDisclosure({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <Collapsible className={className} data-slot="quiet-disclosure">
      <CollapsibleTrigger className={QUIET_ACTION_CLASS}>
        {label}
        <FoldChevron className="size-3.5" inline />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
