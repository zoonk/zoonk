"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { type FeedbackFormRequest } from "./feedback-contract";
import { FeedbackForm } from "./feedback-form";

function FeedbackFormHeader({ isReport }: { isReport: boolean }) {
  const t = useExtracted("feedback");

  if (isReport) {
    return (
      <DrawerHeader closeLabel={t("Close")}>
        <DrawerTitle>{t("Report a problem")}</DrawerTitle>
      </DrawerHeader>
    );
  }

  return (
    <DrawerHeader closeLabel={t("Close")}>
      <DrawerTitle>{t("Send feedback")}</DrawerTitle>
      <DrawerDescription>
        {t("Found a problem or have an idea? Tell us below or email hello@zoonk.com.")}
      </DrawerDescription>
    </DrawerHeader>
  );
}

/** Kept past the close, which clears the request before focus goes back. */
function useLastOpener(request: FeedbackFormRequest | null): HTMLElement | undefined {
  const [opener, setOpener] = useState(request?.opener);

  if (request && request.opener !== opener) {
    setOpener(request.opener);
  }

  return opener;
}

export function FeedbackFormDialog({
  onClose,
  request,
}: {
  onClose: (request: FeedbackFormRequest) => void;
  request: FeedbackFormRequest | null;
}) {
  const t = useExtracted("feedback");
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useLastOpener(request);

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open && request) {
          onClose(request);
        }
      }}
      open={request !== null}
    >
      <DrawerPopup
        finalFocus={opener && (() => (opener.isConnected ? opener : true))}
        initialFocus={request?.context.reportType === "saveFailure" ? dialogRef : undefined}
        ref={dialogRef}
      >
        <FeedbackFormHeader isReport={request?.isReport ?? false} />

        <DrawerContent className="pt-2">
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
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
