"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { useActivityDraggable } from "../_components/activity-drag-drop";
import { rowDragId } from "./categorize-drag-ids";

type Group = { id: string; label: string };

const ROW_CLASS = "flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm";

function CategorizeMoveMenu({
  onMove,
  otherGroups,
}: {
  onMove: (groupId: string) => void;
  otherGroups: readonly Group[];
}) {
  const t = useExtracted();

  return (
    <DropdownMenuContent align="end" className="w-auto">
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          {t({
            description: "Title of the menu that moves a sorted card to another group.",
            message: "Move to",
          })}
        </DropdownMenuLabel>

        {otherGroups.map((group) => (
          <DropdownMenuItem key={group.id} onClick={() => onMove(group.id)}>
            <span className="min-w-0">
              <LessonRichText text={group.label} />
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

export function CategorizeMoveRow({
  groupId,
  id,
  itemId,
  onMove,
  otherGroups,
  text,
}: {
  groupId: string;
  id: string;
  itemId: string;
  onMove: (groupId: string) => void;
  otherGroups: readonly Group[];
  text: string;
}) {
  const { dragProps, isClickAfterDrag, isDragging } = useActivityDraggable({
    from: groupId,
    id: rowDragId(itemId),
  });

  return (
    // The menu holds the row rather than sitting inside it: presses on its portaled items bubble to their React parents, and the row's drag listeners must not get them.
    <DropdownMenu>
      <li
        {...dragProps}
        className={cn(
          "first:*:rounded-t-lg last:*:rounded-b-lg",
          isDragging &&
            "bg-background ring-input relative z-10 rounded-lg border-transparent shadow-lg ring-1",
        )}
      >
        {/* Base UI opens a menu on press; the row opens it on click, so a press that moves can lift the row. */}
        <DropdownMenuTrigger
          className={cn(
            ROW_CLASS,
            "focus-visible:outline-ring cursor-grab touch-manipulation outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid active:cursor-grabbing",
            !isDragging && "hover:bg-muted/60",
          )}
          id={id}
          onClick={(event) => {
            if (isClickAfterDrag()) {
              event.preventBaseUIHandler();
            }
          }}
          onMouseDown={(event) => event.preventBaseUIHandler()}
          onPointerDown={(event) => event.preventBaseUIHandler()}
        >
          <span className="min-w-0 flex-1">
            <LessonRichText text={text} />
          </span>

          <ChevronsUpDown aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>
      </li>

      <CategorizeMoveMenu onMove={onMove} otherGroups={otherGroups} />
    </DropdownMenu>
  );
}

export function CategorizeResultRow({ isRight, text }: { isRight: boolean; text: string }) {
  const t = useExtracted();

  const verdict = isRight
    ? t({
        description:
          "Read by screen readers right after a checked card's text, so it starts with the separator.",
        message: ", right group",
      })
    : t({
        description:
          "Read by screen readers right after a checked card's text, so it starts with the separator.",
        message: ", wrong group",
      });

  return (
    <li
      className={cn(
        ROW_CLASS,
        "first:rounded-t-lg last:rounded-b-lg",
        isRight ? "bg-success/9" : "bg-destructive/9",
      )}
    >
      <span className="min-w-0 flex-1">
        <LessonRichText text={text} />
        <span className="sr-only">{verdict}</span>
      </span>

      {isRight ? (
        <Check aria-hidden="true" className="text-success-text size-4 shrink-0" />
      ) : (
        <X aria-hidden="true" className="text-destructive-text size-4 shrink-0" />
      )}
    </li>
  );
}
