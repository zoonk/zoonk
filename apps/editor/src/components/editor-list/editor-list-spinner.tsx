"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { LoaderCircleIcon } from "lucide-react";
import { useEditorList } from "./editor-list-context";

export function EditorListSpinner({ className, ...props }: React.ComponentProps<"div">) {
  const { pending } = useEditorList();

  if (!pending) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-background/60 absolute inset-0 z-20 flex items-center justify-center",
        className,
      )}
      data-slot="editor-list-spinner"
      {...props}
    >
      <LoaderCircleIcon className="text-muted-foreground size-5 animate-spin" />
    </div>
  );
}
