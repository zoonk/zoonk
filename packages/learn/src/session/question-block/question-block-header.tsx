"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderProgress,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "../../_components/task-header";
import { ContentVoteMenu } from "../../feedback/content-vote-menu";
import { LearnLink } from "../../learn-link";

const PERCENT = 100;

/**
 * The block's header, the same as every full-screen task's: close (answers are kept), the
 * block's name as Today shows it with how far into it the learner is, the question's "…" menu to
 * report a problem, and one bar for the block's questions.
 */
export function QuestionBlockHeader({
  exitHref,
  index,
  title,
  total,
  voteTarget,
}: {
  exitHref: string;
  index: number;
  title: string;
  total: number;
  /** The question to report, when it can be reported now. */
  voteTarget: ContentVoteTarget | null;
}) {
  const t = useExtracted();
  const current = Math.min(index + 1, total);
  // Answers are saved as they go, so Escape closes like the lesson player's close.
  const closeRef = useEscapeClick<HTMLAnchorElement>();

  return (
    <TaskHeader>
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <LearnLink
            aria-keyshortcuts="Escape"
            aria-label={t("Close. Your answers are saved.")}
            className={buttonVariants({ size: "icon", variant: "ghost" })}
            href={exitHref}
            prefetch={false}
            ref={closeRef}
          >
            <XIcon aria-hidden="true" />
          </LearnLink>
        </TaskHeaderSide>

        <TaskHeaderTitle
          detail={t("{current} of {total}", { current: String(current), total: String(total) })}
          title={title}
        />

        <TaskHeaderSide align="end">
          {voteTarget && (
            <ContentVoteMenu
              label={t("Question options")}
              screen="question-block"
              target={voteTarget}
              votes={false}
            />
          )}
        </TaskHeaderSide>
      </TaskHeaderBar>

      <TaskHeaderProgress
        label={t("Question {current, number} of {total, number}", { current, total })}
        value={total === 0 ? 0 : (index / total) * PERCENT}
      />
    </TaskHeader>
  );
}
