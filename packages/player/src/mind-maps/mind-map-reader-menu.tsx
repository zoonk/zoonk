"use client";

import { LearnLink } from "@zoonk/learn/link";
import { TASK_HEADER_ICON_CLASS } from "@zoonk/learn/task-header";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon, EllipsisIcon, ListIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export type MindMapReaderHrefs = { chapter: string; exit: string; lesson: string };

export function MindMapReaderMenu({
  chapterId,
  hrefs,
  isFirst,
  lessonId,
  onRestart,
}: {
  chapterId: string;
  hrefs: MindMapReaderHrefs;
  isFirst: boolean;
  lessonId: string | null;
  onRestart: () => void;
}) {
  const t = useExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn("shrink-0", TASK_HEADER_ICON_CLASS.end)}
            size="icon"
            variant="ghost"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("Map options")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem disabled={isFirst} onClick={onRestart}>
          <RotateCcwIcon aria-hidden="true" />
          {t("Start from the first map")}
        </DropdownMenuItem>

        <DropdownMenuItem render={<LearnLink href={`${hrefs.chapter}/${chapterId}`} />}>
          <ListIcon aria-hidden="true" />
          {t("Open chapter")}
        </DropdownMenuItem>

        {lessonId && (
          <DropdownMenuItem render={<LearnLink href={`${hrefs.lesson}/${lessonId}`} />}>
            <BookOpenIcon aria-hidden="true" />
            {t("Open lesson")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
