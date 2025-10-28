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
import { useTranslations } from "next-intl";
import { ContactForm } from "./contact-form";

interface FeedbackSheetProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
}

export function FeedbackSheet({ children, side }: FeedbackSheetProps) {
  const t = useTranslations("Feedback");

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        className="mx-auto max-w-lg"
        closeLabel={t("closeLabel")}
        side={side}
      >
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        <SheetFooter className="pt-0">
          <ContactForm />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
