"use client";

import { type LessonMap as LessonMapData } from "@zoonk/core/library/lessons/map";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonMap } from "../_components/lesson-map";
import { getLessonFocusTarget } from "../_utils/lesson-focus";

export function LessonMapSheet({
  map,
  onOpenChange,
  open,
  title,
}: {
  map: LessonMapData;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup finalFocus={getLessonFocusTarget}>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
            <NetworkIcon aria-hidden="true" className="size-5" />
            {t("Lesson map")}
          </DrawerTitle>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-6">
          <LessonMap map={map} title={title} />
          <Button className="w-full" onClick={() => onOpenChange(false)} size="lg">
            {t("Got it")}
          </Button>
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
