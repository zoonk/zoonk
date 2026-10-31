"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { showSuccessToast } from "@zoonk/ui/components/toast";
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
      <DialogTitle>{t("Send feedback")}</DialogTitle>
      <DialogDescription>
        {t("Found a problem or have an idea? Tell us below or email hello@zoonk.com.")}
      </DialogDescription>
    </DialogHeader>
  );
}

export function FeedbackFormDialog({
  onClose,
  request,
}: {
  onClose: (request: FeedbackFormRequest) => void;
  request: FeedbackFormRequest | null;
}) {
  const t = useExtracted("feedback");

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && request) {
          onClose(request);
        }
      }}
      open={request !== null}
    >
      <DialogContent closeLabel={t("Close")}>
        <FeedbackFormHeader isReport={request?.isReport ?? false} />

        <DialogFooter>
          {request && (
            <FeedbackForm
              context={request.context}
              layout="dialog"
              onSent={() => {
                showSuccessToast(t("Thanks! We got your message."));
                onClose(request);
              }}
            />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
