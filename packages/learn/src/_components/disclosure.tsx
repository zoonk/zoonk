"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { SpokenMath } from "../rich-text/spoken-math";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "./list-group";

export function Disclosure({
  aside,
  children,
  className,
  defaultOpen = false,
  description,
  icon,
  title,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Collapsible className={className} data-slot="disclosure" defaultOpen={defaultOpen}>
      <CollapsibleTrigger className={cn(LIST_ROW_INTERACTIVE_CLASS, "group/disclosure")}>
        <ListRowLeading>{icon}</ListRowLeading>
        <ListRowBody>
          <ListRowContent>
            <ListRowTitle>{title}</ListRowTitle>
            {description && (
              <ListRowDescription>
                <SpokenMath>{description}</SpokenMath>
              </ListRowDescription>
            )}
          </ListRowContent>
          {aside !== undefined && <ListRowTrailing>{aside}</ListRowTrailing>}
        </ListRowBody>
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-data-panel-open/disclosure:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="flex flex-col gap-5 pt-1 pb-4 in-data-[list=panel]:px-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
