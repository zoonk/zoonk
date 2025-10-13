"use client";

import { track } from "@vercel/analytics";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { MessageSquareIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FeedbackSheet } from "./feedback-sheet";

type ContentFeedbackProps = {
  kind: "courseSuggestions";
  contentId: string;
} & React.ComponentProps<"footer">;

export function ContentFeedback({
  kind,
  contentId,
  className,
}: ContentFeedbackProps) {
  const t = useTranslations("ContentFeedback");
  const [feedback, setFeedback] = useState<"upvote" | "downvote" | null>(null);

  const handleFeedback = (value: "upvote" | "downvote") => {
    // Only track analytics if the feedback value is actually changing
    if (feedback !== value) {
      setFeedback(value);
      track("Feedback", { kind, contentId, feedback: value });
    }
  };

  return (
    <footer
      className={cn("flex flex-col items-center gap-1 text-center", className)}
    >
      <h6 className="text-muted-foreground text-sm">{t("title")}</h6>

      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleFeedback("upvote")}
          className={cn(
            "size-8 hover:bg-green-50 hover:text-green-600",
            feedback === "upvote" && "bg-green-50 text-green-600",
          )}
        >
          <ThumbsUpIcon aria-hidden="true" />
          <span className="sr-only">{t("upvote")}</span>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleFeedback("downvote")}
          className={cn(
            "size-8 hover:bg-red-50 hover:text-red-600",
            feedback === "downvote" && "bg-red-50 text-red-600",
          )}
        >
          <ThumbsDownIcon aria-hidden="true" />
          <span className="sr-only">{t("downvote")}</span>
        </Button>
      </div>

      <FeedbackSheet side="bottom">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <MessageSquareIcon aria-hidden="true" />
          {t("sendFeedback")}
        </Button>
      </FeedbackSheet>
    </footer>
  );
}
