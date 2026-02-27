"use client";

import { FeedbackDialogContent } from "@/components/feedback/feedback-dialog";
import {
  type FeedbackKind,
  type FeedbackValue,
  isFeedbackValue,
  trackFeedback,
} from "@/lib/track-feedback";
import { Button } from "@zoonk/ui/components/button";
import { Dialog, DialogTrigger } from "@zoonk/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { toast } from "@zoonk/ui/components/sonner";
import {
  EllipsisVerticalIcon,
  MessageSquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

export function CatalogActions({
  contentId,
  defaultEmail,
  kind,
}: {
  contentId: string;
  defaultEmail?: string;
  kind: FeedbackKind;
}) {
  const t = useExtracted();
  const [feedback, setFeedback] = useState<FeedbackValue | "">("");

  function handleFeedbackChange(value: FeedbackValue) {
    if (feedback === value) {
      return;
    }
    setFeedback(value);
    trackFeedback({ contentId, feedback: value, kind });
    toast.success(t("Thanks for your feedback"));
  }

  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon" variant="secondary" />}>
          <EllipsisVerticalIcon />
          <span className="sr-only">{t("More options")}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={feedback}
            onValueChange={(value: string) => {
              if (isFeedbackValue(value)) {
                handleFeedbackChange(value);
              }
            }}
          >
            <DropdownMenuRadioItem value="upvote">
              <ThumbsUpIcon />
              {t("Helpful")}
            </DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="downvote">
              <ThumbsDownIcon />
              {t("Not helpful")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DialogTrigger nativeButton={false} render={<DropdownMenuItem />}>
            <MessageSquareIcon />
            {t("Send feedback")}
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackDialogContent defaultEmail={defaultEmail} />
    </Dialog>
  );
}
