"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { NotebookTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonSummaryIdeas } from "../_components/lesson-summary-ideas";
import { getLessonFocusTarget } from "../_utils/lesson-focus";

/**
 * The lesson's summary card over its completion moment, opened from its menu: short lessons end
 * without a summary screen, so on a phone, which has no aside to show it, the card is one tap away
 * (and saved to Content).
 */
export function SummarySheet({
  ideas,
  onOpenChange,
  open,
}: {
  ideas: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup finalFocus={getLessonFocusTarget}>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
            <NotebookTextIcon aria-hidden="true" className="size-5" />
            {t("Lesson summary")}
          </DrawerTitle>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-6">
          <LessonSummaryIdeas ideas={ideas} variant="flat" />
          <Button className="w-full" onClick={() => onOpenChange(false)} size="lg">
            {t("Got it")}
          </Button>
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
