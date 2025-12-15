"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@zoonk/ui/components/sheet";
import { useExtracted } from "next-intl";
import { ContactForm } from "./contact-form";

interface FeedbackSheetProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
}

export function FeedbackSheet({ children, side }: FeedbackSheetProps) {
  const t = useExtracted();

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="mx-auto max-w-lg" side={side}>
        <SheetHeader>
          <SheetTitle>{t("Feedback")}</SheetTitle>
          <SheetDescription>
            {t(
              "Send feedback, questions, or suggestions to us. Fill in the form below or email us directly at hello@zoonk.com.",
            )}
          </SheetDescription>
        </SheetHeader>

        <SheetFooter className="pt-0">
          <ContactForm />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
