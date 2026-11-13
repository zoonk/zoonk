"use client";

import { type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { type BuddyGlasses, type BuddyKind, getBuddyStage } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { SheetHeader } from "../_components/sheet-header";
import { type BuddyGlassesOption, BuddyGlassesPicker } from "../buddies/buddy-glasses-picker";
import { BUDDY_GLASSES, BuddyGlassesWorn, BuddyStageName } from "../buddies/buddy-labels";
import { type BuddyChoice, type BuddyLook, BuddyPicker } from "../buddies/buddy-picker";
import { useBuddyName } from "../buddies/use-buddy-name";

export type AppearanceBuddy = { glasses: BuddyGlasses; kind: BuddyKind; name: string | null };

function toGlassesOptions(available: BuddyGlasses[]): BuddyGlassesOption[] {
  return BUDDY_GLASSES.map((glasses) => ({ earned: available.includes(glasses), glasses }));
}

export function BuddyEditor({
  glasses,
  initial,
  look,
  onClose,
  onSave,
}: {
  glasses?: BuddyGlassesOption[];
  initial: BuddyChoice;
  look: BuddyLook;
  onClose: () => void;
  onSave: (choice: BuddyChoice) => void;
}) {
  const t = useExtracted();
  const [choice, setChoice] = useState(initial);

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle>{t("Your buddy")}</DrawerTitle>
        </SheetHeader>

        <DrawerContent className="flex flex-col gap-6 pt-2">
          <BuddyPicker choice={choice} look={look} onChange={setChoice} />

          {glasses && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("Glasses")}</p>
              <BuddyGlassesPicker
                kind={choice.kind}
                look={look}
                onChange={(next) => setChoice({ ...choice, glasses: next })}
                options={glasses}
                value={choice.glasses}
              />
            </div>
          )}
        </DrawerContent>

        <DrawerFooter>
          <Button onClick={() => onSave(choice)}>{t("Save")}</Button>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}

function CurrentBuddy({ look, buddy }: { look: BuddyLook; buddy: AppearanceBuddy }) {
  const name = useBuddyName(buddy);

  return (
    <>
      <ListRowLeading>
        <Buddy
          beltColor={look.beltColor}
          className="size-9"
          energy={look.energy}
          glasses={buddy.glasses}
          kind={buddy.kind}
          studiedToday={look.studiedToday}
          view="face"
        />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className="truncate">{name}</ListRowTitle>
        <ListRowDescription>
          <BuddyStageName stage={getBuddyStage(look.beltColor)} />
          {" · "}
          <BuddyGlassesWorn glasses={buddy.glasses} />
        </ListRowDescription>
      </ListRowContent>
    </>
  );
}

export function BuddySettings({
  availableGlasses,
  look,
  onSave,
  buddy,
}: {
  availableGlasses: BuddyGlasses[];
  look: BuddyLook;
  onSave: (buddy: AppearanceBuddy) => void;
  buddy: ResolvedBuddy;
}) {
  const t = useExtracted();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <ListGroup>
      <ListRow className="items-center">
        <CurrentBuddy look={look} buddy={buddy} />

        <Button
          aria-haspopup="dialog"
          className="shrink-0"
          onClick={() => setIsEditing(true)}
          size="sm"
          variant="outline"
        >
          {buddy.picked ? t("Change") : t("Choose your buddy")}
        </Button>
      </ListRow>

      {isEditing && (
        <BuddyEditor
          glasses={toGlassesOptions(availableGlasses)}
          initial={{ glasses: buddy.glasses, kind: buddy.kind, name: buddy.name ?? "" }}
          look={look}
          onClose={() => setIsEditing(false)}
          onSave={(choice) => {
            setIsEditing(false);

            onSave({
              glasses: choice.glasses,
              kind: choice.kind,
              name: choice.name.trim() || null,
            });
          }}
        />
      )}
    </ListGroup>
  );
}
