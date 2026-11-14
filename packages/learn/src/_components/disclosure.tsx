"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";
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
  ref,
  title,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: React.ReactNode;
  icon: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
  title: string;
}) {
  return (
    <Collapsible className={className} data-slot="disclosure" defaultOpen={defaultOpen} ref={ref}>
      <CollapsibleTrigger className={LIST_ROW_INTERACTIVE_CLASS}>
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
        <FoldChevron />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-5 pt-1 pb-4 in-data-[list=panel]:px-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
