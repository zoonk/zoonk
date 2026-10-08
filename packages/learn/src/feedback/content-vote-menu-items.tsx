"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { FlagIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useContentFeedback } from "./feedback-context";

/**
 * "Report a problem": a message with the screen attached, and the content it's about when there's
 * one. Nothing for hosts without feedback.
 */
export function ReportProblemItem({
  screen,
  target,
}: {
  screen: string;
  target?: ContentVoteTarget;
}) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <DropdownMenuItem
      onClick={() => feedback.openFeedbackForm({ context: { ...target, screen }, isReport: true })}
    >
      <FlagIcon aria-hidden="true" />
      {t("Report a problem")}
    </DropdownMenuItem>
  );
}

function VoteItems({ target }: { target: ContentVoteTarget }) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();

  // The menu mounts its items when it opens, which is when the learner's earlier vote is needed.
  useEffect(() => {
    feedback?.loadVote(target);
  }, [feedback, target]);

  if (!feedback) {
    return null;
  }

  const vote = feedback.getVote(target);

  return (
    <>
      <DropdownMenuCheckboxItem
        checked={vote === "up"}
        closeOnClick
        onCheckedChange={() => {
          feedback.chooseVote({ target, vote: "up" });
          showSuccessToast(t("Thanks, that helps"));
        }}
      >
        <ThumbsUpIcon aria-hidden="true" />
        {t("Helpful")}
      </DropdownMenuCheckboxItem>

      <DropdownMenuCheckboxItem
        checked={vote === "down"}
        closeOnClick
        onCheckedChange={() => feedback.chooseVote({ target, vote: "down" })}
      >
        <ThumbsDownIcon aria-hidden="true" />
        {t("Not helpful")}
      </DropdownMenuCheckboxItem>

      <DropdownMenuSeparator />
    </>
  );
}

/**
 * The feedback entries of a screen's menu: "Helpful", "Not helpful" (which asks why, lightly) and
 * "Report a problem" (a message with the screen attached). Place them inside a `DropdownMenuContent`
 * for lesson screens, activities and images. `screen` names where the menu is, such as
 * "lesson-step", for the message's context. Without `votes` the menu only reports a problem, as
 * on a question in the middle of a task.
 */
export function ContentVoteMenuItems({
  screen,
  target,
  votes = true,
}: {
  screen: string;
  target: ContentVoteTarget;
  votes?: boolean;
}) {
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <>
      {votes && <VoteItems target={target} />}
      <ReportProblemItem screen={screen} target={target} />
    </>
  );
}
