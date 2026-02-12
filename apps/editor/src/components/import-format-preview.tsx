"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

export function ImportFormatPreview({
  format,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  format: object;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      className={className}
      data-slot="import-format-preview"
      onOpenChange={setOpen}
      open={open}
      {...props}
    >
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors">
        {open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="bg-muted/50 mt-3 max-h-48 overflow-auto rounded-xl p-4 font-mono text-xs wrap-break-word whitespace-pre-wrap">
          {JSON.stringify(format, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
