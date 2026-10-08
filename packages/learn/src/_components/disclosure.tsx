"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "./list-group";

/**
 * Something a page keeps folded until asked (a chapter's summary, a unit's words): a row of its
 * page's list (`ListGroup`) with its icon, title and an optional count, opening in place under it.
 * Closed by default, so the page leads with what to do.
 *
 * ```tsx
 * <ListGroup>
 *   <Disclosure icon={<ListRowIcon><ListChecksIcon /></ListRowIcon>} title="Chapter summary">
 *     …
 *   </Disclosure>
 * </ListGroup>
 * ```
 */
export function Disclosure({
  aside,
  children,
  className,
  icon,
  title,
}: {
  /** A count or a short note before the chevron. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Collapsible className={className} data-slot="disclosure">
      <CollapsibleTrigger className={cn(LIST_ROW_INTERACTIVE_CLASS, "group/disclosure")}>
        <ListRowLeading>{icon}</ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{title}</ListRowTitle>
        </ListRowContent>
        {aside !== undefined && <ListRowTrailing>{aside}</ListRowTrailing>}
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-data-panel-open/disclosure:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="flex flex-col gap-5 px-4 pt-1 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
