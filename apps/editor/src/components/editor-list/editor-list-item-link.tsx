"use client";

import { mergeProps, useRender } from "@zoonk/ui/lib/render";
import { cn } from "@zoonk/ui/lib/utils";

export function EditorListItemLink({ className, render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn("flex min-w-0 flex-1 items-start gap-4", className),
      },
      props,
    ),
    render,
    state: {
      slot: "editor-list-item-link",
    },
  });
}
