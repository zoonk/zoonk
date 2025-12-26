"use client";

import { track } from "@vercel/analytics";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { MessageSquareIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { FeedbackSheet } from "@/components/feedback/feedback-sheet";

type ContentFeedbackProps = {
  kind: "courseSuggestions";
  contentId: string;
} & React.ComponentProps<"footer">;

export function ContentFeedback({
  kind,
  contentId,
  className,
}: ContentFeedbackProps) {
  const t = useExtracted();
  const [feedback, setFeedback] = useState<"upvote" | "downvote" | null>(null);

  const handleFeedback = (value: "upvote" | "downvote") => {
    // Only track analytics if the feedback value is actually changing
    if (feedback !== value) {
      setFeedback(value);
      track("Feedback", { contentId, feedback: value, kind });
    }
  };

  return (
    <footer
      className={cn("flex flex-col items-center gap-1 text-center", className)}
    >
      <h6 className="text-muted-foreground text-sm">
        {t("Did you like this content?")}
      </h6>

      <div className="flex gap-1">
        <Button
          className={cn(
            "size-8 hover:bg-green-50 hover:text-green-600",
            feedback === "upvote" && "bg-green-50 text-green-600",
          )}
          onClick={() => handleFeedback("upvote")}
          size="icon"
          variant="ghost"
        >
          <ThumbsUpIcon aria-hidden="true" />
          <span className="sr-only">{t("I liked it")}</span>
        </Button>

        <Button
          className={cn(
            "size-8 hover:bg-red-50 hover:text-red-600",
            feedback === "downvote" && "bg-red-50 text-red-600",
          )}
          onClick={() => handleFeedback("downvote")}
          size="icon"
          variant="ghost"
        >
          <ThumbsDownIcon aria-hidden="true" />
          <span className="sr-only">{t("I didn't like it")}</span>
        </Button>
      </div>

      <FeedbackSheet side="bottom">
        <Button className="text-muted-foreground" size="sm" variant="ghost">
          <MessageSquareIcon aria-hidden="true" />
          {t("Send feedback")}
        </Button>
      </FeedbackSheet>
    </footer>
  );
}
