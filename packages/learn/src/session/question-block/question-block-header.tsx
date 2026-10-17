"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  TASK_HEADER_ICON_CLASS,
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSegments,
  TaskHeaderSide,
  TaskHeaderTitle,
  type TaskSegment,
} from "../../_components/task-header";
import { LearnLink } from "../../learn-link";

const PERCENT = 100;

/**
 * The block's close: answers are saved as they go, so it just leaves, and Escape closes like the
 * lesson player's close.
 */
export function QuestionBlockClose({ href }: { href: string }) {
  const t = useExtracted();
  const closeRef = useEscapeClick<HTMLAnchorElement>();

  return (
    <LearnLink
      aria-keyshortcuts="Escape"
      aria-label={t("Close. Your answers are saved.")}
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        TASK_HEADER_ICON_CLASS.start,
      )}
      href={href}
      prefetch={false}
      ref={closeRef}
    >
      <XIcon aria-hidden="true" />
    </LearnLink>
  );
}

/**
 * The header of a run of questions (a session block, mistake practice), the same as every
 * full-screen task's: close on the left, the run's name in the middle, the question's "…" menu on
 * the right, and one segment per question under it, green or red once answered. It stays at the
 * top while a long question scrolls.
 */
export function QuestionBlockHeader({
  close,
  index,
  menu,
  segments,
  title,
  total,
}: {
  close: React.ReactNode;
  index: number;
  /** The question's menu, when it can be reported now. */
  menu?: React.ReactNode;
  /** Each question's place: answered right or wrong, the one in view, or ahead. */
  segments: readonly TaskSegment[];
  title: string;
  total: number;
}) {
  const t = useExtracted();
  const current = Math.min(index + 1, total);

  return (
    <TaskHeader className="bg-background sticky top-0 z-20">
      <TaskHeaderBar>
        <TaskHeaderSide align="start">{close}</TaskHeaderSide>
        <TaskHeaderTitle title={title} />
        <TaskHeaderSide align="end">{menu}</TaskHeaderSide>
      </TaskHeaderBar>

      {total > 0 && (
        <TaskHeaderSegments
          label={t("Question {current, number} of {total, number}", { current, total })}
          segments={segments}
          value={(index / total) * PERCENT}
        />
      )}
    </TaskHeader>
  );
}
