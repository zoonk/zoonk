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
import { DrawerCloseButton } from "../_components/details-drawer";
import { BuddyGlassesPicker } from "./buddy-glasses-picker";
import { type BuddyGlassesProgress } from "./buddy-status-view";
import { type LearnBuddy } from "./use-buddy-name";

export function BuddyGlassesSheet({
  buddy,
  glasses,
  onOpenChange,
  onWear,
  open,
}: {
  buddy: LearnBuddy;
  glasses: BuddyGlassesProgress[];
  onOpenChange: (open: boolean) => void;
  onWear: (glasses: BuddyGlasses) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <DrawerTitle className="text-xl font-semibold">{t("Glasses")}</DrawerTitle>
            <DrawerDescription>
              {t({
                description: "The learner's buddy wears the glasses.",
                message: "Pick a pair you've earned.",
              })}
            </DrawerDescription>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-3">
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
