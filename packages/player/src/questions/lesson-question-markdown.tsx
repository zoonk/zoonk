"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ExternalLinkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LinkSafetyModalProps, Streamdown } from "streamdown";
import { getSafeLessonQuestionUrl } from "./lesson-question-url";

const DISALLOWED_ANSWER_ELEMENTS = ["img"] as const;

/**
 * Uses the app's accessible dialog primitive for external links because
 * Streamdown's default confirmation surface does not manage dialog focus.
 */
function ExternalLinkConfirmation({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) {
  const t = useExtracted();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const openLink = () => {
    onConfirm();
    onClose();
  };

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Open this link?")}</AlertDialogTitle>
          <AlertDialogDescription className="flex min-w-0 flex-col gap-3">
            <span>{t("This link opens a website outside Zoonk.")}</span>
            <span className="bg-muted max-h-24 overflow-y-auto rounded-lg p-3 font-mono text-xs break-all">
              {url}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <a
            className={buttonVariants()}
            href={url}
            onClick={(event) => {
              event.preventDefault();
              openLink();
            }}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon aria-hidden="true" />
            {t("Open link")}
          </a>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function renderExternalLinkConfirmation(props: LinkSafetyModalProps) {
  return <ExternalLinkConfirmation {...props} />;
}

const LESSON_QUESTION_LINK_SAFETY = {
  enabled: true,
  renderModal: renderExternalLinkConfirmation,
} as const;

export function LessonQuestionMarkdown({
  answer,
  isAnimating,
  isStreaming,
}: {
  answer: string;
  isAnimating: boolean;
  isStreaming: boolean;
}) {
  return (
    <Streamdown
      animated={isAnimating}
      className="min-w-0 wrap-anywhere [&_a]:underline [&_a]:underline-offset-4"
      controls={false}
      disallowedElements={DISALLOWED_ANSWER_ELEMENTS}
      isAnimating={isAnimating}
      lineNumbers={false}
      linkSafety={LESSON_QUESTION_LINK_SAFETY}
      mode={isStreaming ? "streaming" : "static"}
      urlTransform={getSafeLessonQuestionUrl}
    >
      {answer}
    </Streamdown>
  );
}
