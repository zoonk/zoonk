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
import { Label } from "@zoonk/ui/components/label";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { type BuddyGlasses, type BuddyKind, getBuddyStage } from "@zoonk/utils/buddy";
import { LockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { FUN_PRIMARY_BUTTON_CLASS } from "../_utils/fun-primary";
import {
  BUDDY_GLASSES,
  BuddyGlassesHowToEarn,
  BuddyGlassesName,
  BuddyStageName,
  BuddyTagline,
} from "../buddies/buddy-labels";
import { type BuddyChoice, type BuddyLook, BuddyPicker } from "../buddies/buddy-picker";
import { useBuddyName } from "../buddies/use-buddy-name";

export type AppearanceBuddy = { glasses: BuddyGlasses; kind: BuddyKind; name: string | null };

const GLASSES_OPTION_CLASS =
  "border-border has-data-checked:border-foreground has-focus-visible:ring-ring/50 in-data-[mode=fun]:fun-glass in-data-[mode=fun]:has-data-checked:border-fun-lime flex cursor-pointer items-center gap-3 rounded-2xl border p-2 pr-3 has-focus-visible:ring-[3px] has-data-disabled:cursor-default";

/** One column: the dialog is too narrow for two, which squeezed "how to earn" into four lines. */
function GlassesPicker({
  available,
  choice,
  look,
  onChange,
}: {
  available: BuddyGlasses[];
  choice: BuddyChoice;
  look: BuddyLook;
  onChange: (glasses: BuddyGlasses) => void;
}) {
  const t = useExtracted();

  return (
    <RadioGroup
      aria-label={t("Glasses")}
      className="grid gap-2"
      onValueChange={(value) => {
        const glasses = available.find((item) => item === value);

        if (glasses) {
          onChange(glasses);
        }
      }}
      value={choice.glasses}
    >
      {BUDDY_GLASSES.map((glasses) => {
        const isEarned = available.includes(glasses);

        return (
          <Label className={GLASSES_OPTION_CLASS} key={glasses}>
            <Buddy
              beltColor={look.beltColor}
              className="size-12"
              energy={look.energy}
              expression="happy"
              glasses={glasses}
              kind={choice.kind}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">
                <BuddyGlassesName glasses={glasses} />
              </span>
              <span className="text-muted-foreground flex items-start gap-1 text-xs font-normal">
                {!isEarned && (
                  <LineMarker aria-hidden="true">
                    <LockIcon className="size-3" />
                  </LineMarker>
                )}
                <BuddyGlassesHowToEarn glasses={glasses} />
              </span>
            </span>
            <RadioGroupItem disabled={!isEarned} value={glasses} />
          </Label>
        );
      })}
    </RadioGroup>
  );
}

function BuddyEditor({
  availableGlasses,
  initial,
  look,
  onClose,
  onSave,
}: {
  availableGlasses: BuddyGlasses[];
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Your buddy")}</DialogTitle>
        </DialogHeader>

        <BuddyPicker choice={choice} look={look} onChange={setChoice} />

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("Glasses")}</p>
          <GlassesPicker
            available={availableGlasses}
            choice={choice}
            look={look}
            onChange={(glasses) => setChoice({ ...choice, glasses })}
          />
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            {t("Cancel")}
          </Button>
          <Button className={FUN_PRIMARY_BUTTON_CLASS} onClick={() => onSave(choice)}>
            {t("Save")}
          </Button>
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
 * The Fun buddy: who it is, how it looks and a way to change it, rename it or pick earned glasses.
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
    <div className="border-border in-data-[mode=fun]:fun-glass flex items-center gap-3 rounded-2xl border p-3">
      {buddy ? (
        <CurrentBuddy look={look} buddy={buddy} />
      ) : (
        <span className="text-muted-foreground flex-1 text-sm">
          {t("Pick a buddy to feed with what you learn.")}
        </span>
      )}

      <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
        {buddy ? t("Change") : t("Choose your buddy")}
      </Button>

      {isEditing && (
        <BuddyEditor
          availableGlasses={availableGlasses}
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
