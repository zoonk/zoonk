"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { BUDDY_KINDS, BuddyTagline } from "./buddy-labels";
import { useBuddyName } from "./use-buddy-name";

/** Custom names stay short so they fit the dock and the buddy's lines. */
const BUDDY_NAME_MAX_LENGTH = 24;

export type BuddyChoice = { glasses: BuddyGlasses; kind: BuddyKind; name: string };

/** How a buddy looks right now: it grows with the belt and glows with Energy. */
export type BuddyLook = { beltColor: BeltColor; energy: number };

const OPTION_CLASS =
  "border-border has-data-checked:border-foreground has-focus-visible:ring-ring/50 in-data-[mode=fun]:fun-glass in-data-[mode=fun]:has-data-checked:border-fun-lime relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border p-3 pt-4 text-center has-focus-visible:ring-[3px]";

function BuddyOption({
  choice,
  kind,
  look,
}: {
  choice: BuddyChoice;
  kind: BuddyKind;
  look: BuddyLook;
}) {
  const name = useBuddyName({ kind, name: null });

  return (
    <Label className={OPTION_CLASS}>
      <RadioGroupItem className="absolute top-3 right-3" value={kind} />
      <Buddy
        beltColor={look.beltColor}
        className="size-20"
        energy={look.energy}
        expression="happy"
        glasses={choice.kind === kind ? choice.glasses : "round"}
        kind={kind}
      />
      <span className="in-data-[mode=fun]:font-fun-display text-base font-semibold">{name}</span>
      <span className="text-muted-foreground text-xs">
        <BuddyTagline kind={kind} />
      </span>
    </Label>
  );
}

/**
 * Choosing a Fun buddy: Zu, Noodle, Beep or Otto, and a name. Onboarding and Appearance share it.
 * An empty name keeps the buddy's own name in each language.
 */
export function BuddyPicker({
  choice,
  look,
  onChange,
}: {
  choice: BuddyChoice;
  look: BuddyLook;
  onChange: (choice: BuddyChoice) => void;
}) {
  const t = useExtracted();
  const nameId = useId();
  const defaultName = useBuddyName({ kind: choice.kind, name: null });

  return (
    <div className="flex flex-col gap-5" data-slot="buddy-picker">
      <RadioGroup
        aria-label={t("Buddy")}
        className="grid grid-cols-2 gap-3"
        onValueChange={(value) => {
          const kind = BUDDY_KINDS.find((item) => item === value);

          if (kind) {
            onChange({ ...choice, kind });
          }
        }}
        value={choice.kind}
      >
        {BUDDY_KINDS.map((kind) => (
          <BuddyOption choice={choice} key={kind} kind={kind} look={look} />
        ))}
      </RadioGroup>

      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>{t("Name")}</Label>
        <Input
          autoComplete="off"
          id={nameId}
          maxLength={BUDDY_NAME_MAX_LENGTH}
          onChange={(event) => onChange({ ...choice, name: event.target.value })}
          placeholder={defaultName}
          value={choice.name}
        />
      </div>
    </div>
  );
}
