"use client";

import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { type FeedbackKind, type FeedbackValue, trackFeedback } from "@/lib/track-feedback";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { MessageSquareIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

export function ContentFeedback({
  kind,
  contentId,
  variant = "default",
  className,
  ...props
}: {
  kind: FeedbackKind;
  contentId: string;
  variant?: "default" | "minimal";
} & React.ComponentProps<"footer">) {
  const t = useExtracted();
  const [feedback, setFeedback] = useState<FeedbackValue | null>(null);
  const isMinimal = variant === "minimal";
  const iconSize = isMinimal ? "size-7" : "size-8";

  function handleFeedback(value: FeedbackValue) {
    if (feedback !== value) {
      setFeedback(value);
      trackFeedback({ contentId, feedback: value, kind });
    }
  }

  return (
    <footer className={cn("flex flex-col items-center gap-1 text-center", className)} {...props}>
      {!isMinimal && (
        <h6 className="text-muted-foreground text-sm">{t("Did you like this content?")}</h6>
      )}

      <div className="flex gap-1">
        <Button
          aria-pressed={feedback === "upvote"}
          className={cn(
            iconSize,
            "hover:bg-success/10 hover:text-success",
            feedback === "upvote" && "bg-success/10 text-success",
          )}
          onClick={() => handleFeedback("upvote")}
          size="icon"
          variant="ghost"
        >
          <ThumbsUpIcon aria-hidden="true" />
          <span className="sr-only">{t("I liked it")}</span>
        </Button>

        <Button
          aria-pressed={feedback === "downvote"}
          className={cn(
            iconSize,
            "hover:bg-destructive/10 hover:text-destructive",
            feedback === "downvote" && "bg-destructive/10 text-destructive",
          )}
          onClick={() => handleFeedback("downvote")}
          size="icon"
          variant="ghost"
        >
          <ThumbsDownIcon aria-hidden="true" />
          <span className="sr-only">{t("I didn't like it")}</span>
        </Button>
      </div>

      <FeedbackDialog>
        <Button className="text-muted-foreground" size="sm" variant="ghost">
          <MessageSquareIcon aria-hidden="true" />
          {t("Send feedback")}
        </Button>
      </FeedbackDialog>
    </footer>
  );
}
