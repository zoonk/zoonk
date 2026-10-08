"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { cn } from "@zoonk/ui/lib/utils";
import { type BuddyGlasses, type BuddyKind, getBuddyStage } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { SURFACE_CLASS } from "../_components/surface";
import { type BuddyGlassesOption, BuddyGlassesPicker } from "../buddies/buddy-glasses-picker";
import { BUDDY_GLASSES, BuddyStageName, BuddyTagline } from "../buddies/buddy-labels";
import { type BuddyChoice, type BuddyLook, BuddyPicker } from "../buddies/buddy-picker";
import { useBuddyName } from "../buddies/use-buddy-name";

export type AppearanceBuddy = { glasses: BuddyGlasses; kind: BuddyKind; name: string | null };

/** Appearance knows which pairs are earned, not how far the rest are. */
function toGlassesOptions(available: BuddyGlasses[]): BuddyGlassesOption[] {
  return BUDDY_GLASSES.map((glasses) => ({ earned: available.includes(glasses), glasses }));
}

/**
 * Changing the buddy, its name and its glasses in one dialog. Appearance opens it with the glasses;
 * the pencil beside the buddy's name on its tab opens it without them, since that tab has its own
 * glasses sheet.
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
      <Buddy
        beltColor={look.beltColor}
        className="size-14"
        energy={look.energy}
        glasses={buddy.glasses}
        kind={buddy.kind}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-1.5 text-base font-semibold">
          <span className="truncate">{name}</span>
          <span className="text-muted-foreground shrink-0 font-normal before:mr-1.5 before:content-['·']">
            <BuddyStageName stage={getBuddyStage(look.beltColor)} />
          </span>
        </span>
        <span className="text-muted-foreground text-sm">
          <BuddyTagline kind={buddy.kind} />
        </span>
      </span>
    </>
  );
}

/**
 * The buddy: who it is, how it looks and a way to change it, rename it or pick earned glasses.
 * Growth and glow come from the belt and Energy, so only kind, name and glasses are saved.
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
  buddy: AppearanceBuddy | null;
}) {
  const t = useExtracted();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={cn(SURFACE_CLASS, "flex items-center gap-3 p-4")}>
      {buddy ? (
        <CurrentBuddy look={look} buddy={buddy} />
      ) : (
        <span className="text-muted-foreground flex-1 text-sm">
          {t("Pick a buddy who learns with you.")}
        </span>
      )}

      <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
        {buddy ? t("Change") : t("Choose your buddy")}
      </Button>

      {isEditing && (
        <BuddyEditor
          glasses={toGlassesOptions(availableGlasses)}
          initial={{
            glasses: buddy?.glasses ?? "round",
            kind: buddy?.kind ?? "zu",
            name: buddy?.name ?? "",
          }}
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
    </div>
  );
}
