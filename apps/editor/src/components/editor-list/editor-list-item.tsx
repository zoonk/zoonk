"use client";

import { cn } from "@zoonk/ui/lib/utils";

export function EditorListItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn(className)} data-slot="editor-list-item" {...props} />;
}
