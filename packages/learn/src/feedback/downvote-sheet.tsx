"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { Textarea } from "@zoonk/ui/components/textarea";
import { Toggle } from "@zoonk/ui/components/toggle";
import { PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { useContentFeedback } from "./feedback-context";
import { type ContentFeedbackReason, getVoteKey } from "./feedback-contract";

const REASONS: ContentFeedbackReason[] = [
  "hardToFollow",
  "wrongOrOutdated",
  "tooEasy",
  "tooHard",
  "notWhatINeeded",
  "somethingElse",
];

const MAX_COMMENT_LENGTH = 1000;

function ReasonLabel({ reason }: { reason: ContentFeedbackReason }) {
  const t = useExtracted("feedback");

  switch (reason) {
    case "hardToFollow":
      return t("Hard to follow");
    case "wrongOrOutdated":
      return t("Wrong or outdated");
    case "tooEasy":
      return t("Too easy");
    case "tooHard":
      return t("Too hard");
    case "notWhatINeeded":
      return t("Not what I needed");
    case "somethingElse":
      return t("Something else");
    default:
      return t("Something else");
  }
}

function toggleReason(reasons: ContentFeedbackReason[], reason: ContentFeedbackReason) {
  return reasons.includes(reason)
    ? reasons.filter((item) => item !== reason)
    : [...reasons, reason];
}

/** Keyed by the content, so each downvote starts with no reasons and an empty comment. */
function DownvoteDetails({ onClose, target }: { onClose: () => void; target: ContentVoteTarget }) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();
  const commentId = useId();
  const [reasons, setReasons] = useState<ContentFeedbackReason[]>([]);
  const [comment, setComment] = useState("");

  function send() {
    feedback?.saveDownvoteDetails({ comment: comment.trim(), reasons, target });
    onClose();
  }

  return (
    <DrawerContent className="flex flex-col gap-5">
      <div aria-label={t("Reasons")} className="flex flex-wrap gap-2" role="group">
        {REASONS.map((reason) => (
          <Toggle
            className="aria-pressed:border-foreground h-11 rounded-full px-4 aria-pressed:font-semibold"
            key={reason}
            onPressedChange={() => setReasons((current) => toggleReason(current, reason))}
            pressed={reasons.includes(reason)}
            variant="outline"
          >
            <ReasonLabel reason={reason} />
          </Toggle>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={commentId}>
          {t("Tell us more (optional)")}
        </label>
        <Textarea
          id={commentId}
          maxLength={MAX_COMMENT_LENGTH}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("Tell us more (optional)")}
          value={comment}
        />
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <PaperclipIcon aria-hidden="true" className="size-3.5" />
          {t("This screen is attached")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onClose} size="lg" variant="outline">
          {t("Skip")}
        </Button>
        <Button onClick={send} size="lg">
          {t("Send")}
        </Button>
      </div>
    </DrawerContent>
  );
}

/**
 * A downvote asks why, lightly: reason chips and an optional comment. The vote is already saved
 * when this opens, so skipping keeps it; sending adds the reasons and comment.
 */
export function DownvoteSheet({
  onClose,
  target,
}: {
  onClose: () => void;
  target: ContentVoteTarget | null;
}) {
  const t = useExtracted("feedback");

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={target !== null}
    >
      <DrawerPopup>
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">{t("What went wrong?")}</DrawerTitle>
          <DrawerDescription>
            {t("Pick what fits. It helps us fix this for everyone.")}
          </DrawerDescription>
        </DrawerHeader>

        {target && <DownvoteDetails key={getVoteKey(target)} onClose={onClose} target={target} />}
      </DrawerPopup>
    </Drawer>
  );
}
