"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { EllipsisIcon, PlusIcon } from "lucide-react";
import { useEditorList } from "./editor-list-context";

export function EditorListItemActions({
  "aria-label": ariaLabel,
  insertAboveLabel,
  insertBelowLabel,
  position,
}: {
  "aria-label": string;
  insertAboveLabel: string;
  insertBelowLabel: string;
  position: number;
}) {
  const { pending, handleInsert } = useEditorList();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="text-muted-foreground hover:bg-muted hover:text-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
        disabled={pending}
      >
        <EllipsisIcon className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleInsert(position)}>
          <PlusIcon />
          {insertAboveLabel}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleInsert(position + 1)}>
          <PlusIcon />
          {insertBelowLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
