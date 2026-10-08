"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderProgress,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "../_components/task-header";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { LearnLink } from "../learn-link";

const PERCENT = 100;

/**
 * A test's header (a chapter's test-out, the focus test), the same as every full-screen task's:
 * close back where it was opened, its title with how far in, the question's "…" menu to report a
 * problem and one bar.
 */
export function QuestionsHeader({
  closeHref,
  index,
  itemId,
  screen,
  title,
  total,
}: {
  closeHref: string;
  index: number;
  /** The question on screen, to report; null while there's none. */
  itemId: string | null;
  /** The screen a report names. */
  screen: string;
  title: string;
  total: number;
}) {
  const t = useExtracted();
  const current = Math.min(index + 1, total);

  return (
    <TaskHeader>
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <LearnLink
            aria-label={t("Close")}
            className={buttonVariants({ size: "icon", variant: "ghost" })}
            href={closeHref}
            prefetch={false}
          >
            <XIcon aria-hidden="true" />
          </LearnLink>
        </TaskHeaderSide>

        <TaskHeaderTitle
          detail={
            total > 0
              ? t("{current} of {total}", { current: String(current), total: String(total) })
              : null
          }
          title={title}
        />

        <TaskHeaderSide align="end">
          {itemId && (
            <ContentVoteMenu
              label={t("Question options")}
              screen={screen}
              target={{ contentId: itemId, contentKind: "item" }}
              votes={false}
            />
          )}
        </TaskHeaderSide>
      </TaskHeaderBar>

      {total > 0 && (
        <TaskHeaderProgress
          label={t("Question {current, number} of {total, number}", { current, total })}
          value={(index / total) * PERCENT}
        />
      )}
    </TaskHeader>
  );
}
