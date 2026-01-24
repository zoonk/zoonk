"use client";

import { cn } from "@zoonk/ui/lib/utils";

export function EditorListHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 px-4 pb-2", className)}
      data-slot="editor-list-header"
      {...props}
    />
  );
}
