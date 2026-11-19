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
import { cn } from "@zoonk/ui/lib/utils";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { SheetHeader } from "../_components/sheet-header";
import { SIDE_DETAIL_PLACE_CLASS, SideDetail, useSideColumn } from "../_components/side-detail";
import { type BuddyGlassesOption, BuddyGlassesPicker } from "../buddies/buddy-glasses-picker";
import { BUDDY_GLASSES } from "../buddies/buddy-labels";
import { type BuddyChoice, type BuddyLook, BuddyPicker } from "../buddies/buddy-picker";
import { useBuddyName, useDefaultBuddyName } from "../buddies/use-buddy-name";

export type AppearanceBuddy = { glasses: BuddyGlasses; kind: BuddyKind; name: string | null };

function toGlassesOptions(available: BuddyGlasses[]): BuddyGlassesOption[] {
  return BUDDY_GLASSES.map((glasses) => ({ earned: available.includes(glasses), glasses }));
}

export function BuddyEditor({
  beside = false,
  glasses,
  initial,
  look,
  onClose,
  onSave,
  picked,
}: {
  /** Open in the settings' aside, beside the row that opened it, instead of over the page. */
  beside?: boolean;
  glasses?: BuddyGlassesOption[];
  initial: BuddyChoice;
  look: BuddyLook;
  onClose: () => void;
  onSave: (choice: BuddyChoice) => void;
  picked: boolean;
}) {
  const t = useExtracted();
  const defaultName = useDefaultBuddyName();

  const [choice, setChoice] = useState(() => ({
    ...initial,
    name: initial.name || defaultName(initial.kind),
  }));

  const trimmedName = choice.name.trim();
  const name = initial.name || trimmedName !== defaultName(choice.kind) ? trimmedName : "";

  const changed =
    !picked ||
    choice.kind !== initial.kind ||
    choice.glasses !== initial.glasses ||
    name !== initial.name;

  const picker = (
    <>
      <BuddyPicker
        choice={choice}
        look={look}
        onChange={setChoice}
        showDefaultName={!initial.name}
      />

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
    </>
  );

  const save = (
    <Button disabled={!changed} onClick={() => onSave({ ...choice, name })} size="lg">
      {t("Save")}
    </Button>
  );

  if (beside) {
    return (
      <SideDetail footer={save} onClose={onClose} title={t("Your buddy")}>
        {picker}
      </SideDetail>
    );
  }

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

        <DrawerContent className="flex flex-col gap-5 pt-2">{picker}</DrawerContent>

        <DrawerFooter>{save}</DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}

/**
 * The learner's buddy, whole, in the section's aside until its editor opens there. The row beside
 * it names it, so this only shows it.
 */
function BuddyBeside({ buddy, look }: { buddy: AppearanceBuddy; look: BuddyLook }) {
  return (
    <div
      aria-hidden="true"
      className={cn(SIDE_DETAIL_PLACE_CLASS, "hidden items-center pt-16")}
      data-slot="buddy-beside"
    >
      <Buddy
        beltColor={look.beltColor}
        className="size-44"
        energy={look.energy}
        glasses={buddy.glasses}
        kind={buddy.kind}
        studiedToday={look.studiedToday}
      />
    </div>
  );
}

function CurrentBuddy({ look, buddy }: { look: BuddyLook; buddy: AppearanceBuddy }) {
  const name = useBuddyName(buddy);

  return (
    <>
      <ListRowLeading>
        <Buddy
          beltColor={look.beltColor}
          className="size-8"
          energy={look.energy}
          glasses={buddy.glasses}
          kind={buddy.kind}
          studiedToday={look.studiedToday}
          view="face"
        />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className="truncate">{name}</ListRowTitle>
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
  const beside = useSideColumn();
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => {
    setIsEditing(false);
    trigger.current?.focus();
  };

  return (
    <>
      <ListGroup>
        <ListRow className="items-center">
          <CurrentBuddy look={look} buddy={buddy} />

          <Button
            aria-haspopup={beside ? undefined : "dialog"}
            className="shrink-0"
            onClick={() => setIsEditing(true)}
            ref={trigger}
            size="lg"
            variant="outline"
          >
            {buddy.picked ? t("Change") : t("Choose your buddy")}
          </Button>
        </ListRow>
      </ListGroup>

      {!isEditing && <BuddyBeside buddy={buddy} look={look} />}

      {isEditing && (
        <BuddyEditor
          beside={beside}
          glasses={toGlassesOptions(availableGlasses)}
          initial={{ glasses: buddy.glasses, kind: buddy.kind, name: buddy.name ?? "" }}
          look={look}
          onClose={close}
          picked={buddy.picked}
          onSave={(choice) => {
            close();

            onSave({
              glasses: choice.glasses,
              kind: choice.kind,
              name: choice.name.trim() || null,
            });
          }}
        />
      )}
    </>
  );
}
