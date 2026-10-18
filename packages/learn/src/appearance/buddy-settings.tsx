"use client";

import { type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
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
import { type BuddyGlassesOption, BuddyGlassesPicker } from "../buddies/buddy-glasses-picker";
import { BUDDY_GLASSES, BuddyGlassesWorn, BuddyStageName } from "../buddies/buddy-labels";
import { type BuddyChoice, type BuddyLook, BuddyPicker } from "../buddies/buddy-picker";
import { useBuddyName } from "../buddies/use-buddy-name";

export type AppearanceBuddy = { glasses: BuddyGlasses; kind: BuddyKind; name: string | null };

/** Preferences knows which pairs are earned, not how far the rest are. */
function toGlassesOptions(available: BuddyGlasses[]): BuddyGlassesOption[] {
  return BUDDY_GLASSES.map((glasses) => ({ earned: available.includes(glasses), glasses }));
}

/**
 * Changing the buddy, its name and its glasses in one dialog. Preferences opens it with the
 * glasses; the buddy's tab opens it without them, since that tab has its own glasses sheet.
 */
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
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto" closeLabel={t("Close")}>
        <DialogHeader>
          <DialogTitle>{t("Your buddy")}</DialogTitle>
        </DialogHeader>

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

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            {t("Cancel")}
          </Button>
          <Button onClick={() => onSave(choice)}>{t("Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

/**
 * The buddy as a row of the page's list: who it is and how it looks, with a way to change it,
 * rename it or pick earned glasses at the row's end. Growth and glow come from the belt and
 * Energy, so only kind, name and glasses are saved.
 */
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
