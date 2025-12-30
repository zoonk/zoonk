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
import type { ReactElement } from "react";
import { ContactForm } from "./contact-form";

type FeedbackDialogProps = {
  children: ReactElement;
};

export function FeedbackDialog({ children }: FeedbackDialogProps) {
  const t = useExtracted();

  return (
    <Dialog>
      <DialogTrigger render={children} />
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
    </Dialog>
  );
}
