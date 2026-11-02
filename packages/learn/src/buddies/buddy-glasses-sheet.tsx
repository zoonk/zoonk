"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { BuddyGlassesPicker } from "./buddy-glasses-picker";
import { type BuddyGlassesProgress } from "./buddy-status-view";
import { type LearnBuddy } from "./use-buddy-name";

export function BuddyGlassesSheet({
  buddy,
  failed,
  glasses,
  onOpenChange,
  onWear,
  open,
}: {
  buddy: LearnBuddy;
  failed: boolean;
  glasses: BuddyGlassesProgress[];
  onOpenChange: (open: boolean) => void;
  onWear: (glasses: BuddyGlasses) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">{t("Glasses")}</DrawerTitle>
          <DrawerDescription>
            {t({
              description: "The learner's buddy wears the glasses.",
              message: "Pick a pair you've earned to wear it.",
            })}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-3">
          {failed && <ChangeSaveError />}

          <BuddyGlassesPicker
            kind={buddy.kind}
            look={buddy}
            onChange={onWear}
            options={glasses}
            value={buddy.glasses}
          />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
