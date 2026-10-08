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
import { BuddyGlassesPicker } from "./buddy-glasses-picker";
import { type BuddyGlassesProgress } from "./buddy-status-view";
import { type LearnBuddy } from "./use-buddy-name";

/**
 * Every pair of glasses, opened from the buddy's menu: the earned ones go on with one tap and the
 * rest say how they're earned and how far along the learner is.
 */
export function BuddyGlassesSheet({
  buddy,
  failed,
  glasses,
  onOpenChange,
  onWear,
  open,
}: {
  buddy: LearnBuddy;
  /** The last pair picked didn't save, so the buddy kept the one before. */
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
          <DrawerDescription>{t("Pick a pair you've earned to wear it.")}</DrawerDescription>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-3">
          {failed && (
            <p className="text-destructive text-sm" role="alert">
              {t("That didn't save. Try again in a moment.")}
            </p>
          )}

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
