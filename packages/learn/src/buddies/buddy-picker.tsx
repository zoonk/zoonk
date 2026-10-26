"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { CHOICE_CARD_PICKED_CLASS } from "../onboarding/choice-styles";
import { useKeptTyping } from "../use-kept-typing";
import { BUDDY_KINDS, BuddyTagline } from "./buddy-labels";
import { useBuddyName } from "./use-buddy-name";

/** Custom names stay short so they fit wherever the buddy is named. */
const BUDDY_NAME_MAX_LENGTH = 24;

export type BuddyChoice = { glasses: BuddyGlasses; kind: BuddyKind; name: string };

/** How a buddy looks right now: it grows with the belt and glows with Energy. */
export type BuddyLook = { beltColor: BeltColor; energy: number | null; studiedToday?: boolean };

/** A buddy option as a card, picked as every pick is: the line in the text color on its tint. */
const OPTION_CLASS = cn(
  "border-border has-focus-visible:ring-ring/50 relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 pt-4 text-center has-focus-visible:ring-[3px]",
  CHOICE_CARD_PICKED_CLASS,
);

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
    <RadioGroupOption className={OPTION_CLASS}>
      <RadioGroupItem className="absolute top-3 right-3" value={kind} />
      <Buddy
        beltColor={look.beltColor}
        className="size-20"
        energy={look.energy}
        expression="happy"
        glasses={choice.kind === kind ? choice.glasses : "round"}
        kind={kind}
        studiedToday={look.studiedToday}
      />
      <span className="text-base font-semibold">{name}</span>
      <span className="text-muted-foreground text-xs">
        <BuddyTagline kind={kind} />
      </span>
    </RadioGroupOption>
  );
}

/**
 * Choosing a buddy: Zu, Noodle, Beep or Otto, and a name. Onboarding and Preferences share it.
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

  // A name typed before the step's code arrived is the buddy's name.
  const keptName = useKeptTyping((name) => onChange({ ...choice, name }));
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
          {...keptName.field}
          maxLength={BUDDY_NAME_MAX_LENGTH}
          onChange={(event) => onChange({ ...choice, name: event.target.value })}
          placeholder={defaultName}
          value={choice.name}
        />
      </div>
    </div>
  );
}
