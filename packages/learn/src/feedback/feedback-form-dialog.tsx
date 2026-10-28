"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { useExtracted } from "next-intl";
import { type FeedbackFormRequest } from "./feedback-contract";
import { FeedbackForm } from "./feedback-form";

function FeedbackFormHeader({ isReport }: { isReport: boolean }) {
  const t = useExtracted("feedback");

  if (isReport) {
    return (
      <DialogHeader>
        <DialogTitle>{t("Report a problem")}</DialogTitle>
      </DialogHeader>
    );
  }

  return (
    <DialogHeader>
      <DialogTitle>{t("Feedback")}</DialogTitle>
      <DialogDescription>
        {t(
          "Send feedback, questions, or suggestions to us. Fill in the form below or email us directly at hello@zoonk.com.",
        )}
      </DialogDescription>
    </DialogHeader>
  );
}

export function FeedbackFormDialog({
  onClose,
  request,
}: {
  onClose: () => void;
  request: FeedbackFormRequest | null;
}) {
  const t = useExtracted("feedback");

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={request !== null}
    >
      <DialogContent closeLabel={t("Close")}>
        <FeedbackFormHeader isReport={request?.isReport ?? false} />

        <DialogFooter>
          {request && <FeedbackForm context={request.context} layout="dialog" />}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
