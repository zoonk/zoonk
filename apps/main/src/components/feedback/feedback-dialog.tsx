"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zoonk/ui/components/dialog";
import { useExtracted } from "next-intl";
import { type ReactElement } from "react";
import { ContactForm } from "./contact-form";

export function FeedbackDialogContent() {
  const t = useExtracted();

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("Feedback")}</DialogTitle>
        <DialogDescription>
          {t(
            "Send feedback, questions, or suggestions to us. Fill in the form below or email us directly at hello@zoonk.com.",
          )}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <ContactForm />
      </DialogFooter>
    </DialogContent>
  );
}

export function FeedbackDialog({ children }: { children: ReactElement }) {
  return (
    <Dialog>
      <DialogTrigger render={children} />
      <FeedbackDialogContent />
    </Dialog>
  );
}
