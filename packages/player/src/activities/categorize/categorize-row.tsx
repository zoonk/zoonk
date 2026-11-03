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
  id,
  onMove,
  otherGroups,
  text,
}: {
  id: string;
  onMove: (groupId: string) => void;
  otherGroups: readonly Group[];
  text: string;
}) {
  return (
    <li>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            ROW_CLASS,
            "hover:bg-muted/60 focus-visible:outline-ring outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid",
          )}
          id={id}
        >
          <span className="min-w-0 flex-1">
            <LessonRichText text={text} />
          </span>

          <ChevronsUpDown aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>

        <CategorizeMoveMenu onMove={onMove} otherGroups={otherGroups} />
      </DropdownMenu>
    </li>
  );
}

export function CategorizeResultRow({ isRight, text }: { isRight: boolean; text: string }) {
  const t = useExtracted();
  const verdict = isRight ? t("right group") : t("wrong group");

  return (
    <li className={cn(ROW_CLASS, isRight ? "bg-success/9" : "bg-destructive/9")}>
      <span className="min-w-0 flex-1">
        <LessonRichText text={text} />
        <span className="sr-only">{`, ${verdict}`}</span>
      </span>

      {isRight ? (
        <Check aria-hidden="true" className="text-success-text size-4 shrink-0" />
      ) : (
        <X aria-hidden="true" className="text-destructive-text size-4 shrink-0" />
      )}
    </li>
  );
}
