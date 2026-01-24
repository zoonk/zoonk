"use client";

import { cn } from "@zoonk/ui/lib/utils";

export function EditorListContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn(className)} data-slot="editor-list-content" {...props} />;
}
