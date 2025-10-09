"use client";

import { useTranslations } from "next-intl";
import { ContactForm } from "./contact-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

interface FeedbackSheetProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
}

export function FeedbackSheet({ children, side }: FeedbackSheetProps) {
  const t = useTranslations("Feedback");

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side={side}
        closeLabel={t("closeLabel")}
        className="mx-auto max-w-lg"
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
