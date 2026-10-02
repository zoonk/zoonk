"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useContentFeedback } from "./feedback-context";

function ThumbButtons({ target }: { target: ContentVoteTarget }) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();
  const vote = feedback?.getVote(target);

  if (!feedback) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        aria-pressed={vote === "up"}
        className={cn(
          "text-muted-foreground size-11 sm:size-9",
          vote === "up" && "text-foreground bg-muted",
        )}
        onClick={() => feedback.chooseVote({ target, vote: "up" })}
        size="icon"
        variant="ghost"
      >
        <ThumbsUpIcon aria-hidden="true" />
        <span className="sr-only">{t("Helpful")}</span>
      </Button>

      <Button
        aria-pressed={vote === "down"}
        className={cn(
          "text-muted-foreground size-11 sm:size-9",
          vote === "down" && "text-foreground bg-muted",
        )}
        onClick={() => feedback.chooseVote({ target, vote: "down" })}
        size="icon"
        variant="ghost"
      >
        <ThumbsDownIcon aria-hidden="true" />
        <span className="sr-only">{t("Not helpful")}</span>
      </Button>
    </div>
  );
}

/**
 * Small thumbs under a tutor answer or a quick explanation. A thumbs down asks why, lightly.
 */
export function ContentThumbs({
  className,
  target,
}: {
  className?: string;
  target: ContentVoteTarget;
}) {
  return (
    <div className={className} data-slot="content-thumbs">
      <ThumbButtons target={target} />
    </div>
  );
}

type ThumbsAbout = "explanation" | "lesson" | "plan";

function ThumbsQuestion({ about }: { about: ThumbsAbout }) {
  const t = useExtracted("feedback");

  switch (about) {
    case "explanation":
      return t("Was this explanation helpful?");
    case "plan":
      return t("Does this plan fit you?");
    case "lesson":
      return t("Was this lesson helpful?");
    default:
      return t("Was this lesson helpful?");
  }
}

/**
 * A quiet thumbs row with its question: on a lesson's completion moment, at the end of a quick
 * explanation or under the plan.
 */
export function ContentThumbsRow({
  about = "lesson",
  className,
  target,
}: {
  about?: ThumbsAbout;
  className?: string;
  target: ContentVoteTarget;
}) {
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <div
      className={cn("text-muted-foreground flex items-center gap-2 text-sm", className)}
      data-slot="content-thumbs-row"
    >
      <span>
        <ThumbsQuestion about={about} />
      </span>
      <ThumbButtons target={target} />
    </div>
  );
}
