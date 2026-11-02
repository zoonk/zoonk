"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { cn } from "@zoonk/ui/lib/utils";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { LockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { CHOICE_CARD_PICKED_CLASS } from "../onboarding/choice-styles";
import { BuddyGlassesHowToEarn, BuddyGlassesName } from "./buddy-labels";
import { type BuddyLook } from "./buddy-picker";

export type BuddyGlassesOption = {
  current?: number;
  earned: boolean;
  glasses: BuddyGlasses;
  target?: number;
};

const COUNTED_GLASSES = new Set<BuddyGlasses>(["catEye", "retro"]);

const OPTION_CLASS = cn(
  "border-border has-focus-visible:ring-ring/50 flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-2 pr-3 has-focus-visible:ring-[3px] has-data-disabled:cursor-default",
  CHOICE_CARD_PICKED_CLASS,
);

function CountLine({
  current,
  glasses,
  target,
}: {
  current: number;
  glasses: BuddyGlasses;
  target: number;
}) {
  const t = useExtracted();

  return glasses === "catEye"
    ? t({
        description: "{target} is 7, so a noun that counts it stays plural in every form.",
        message:
          "{current, plural, =0 {# of {target} days with every mission done} one {# of {target} days with every mission done} other {# of {target} days with every mission done}}",
        values: { current, target: String(target) },
      })
    : t("{current} of {target} reviews", { current: String(current), target: String(target) });
}

function LockedDetail({ option }: { option: BuddyGlassesOption }) {
  const { current, glasses, target } = option;

  const counted =
    COUNTED_GLASSES.has(glasses) && current !== undefined && target ? { current, target } : null;

  return (
    <span className="flex flex-col gap-1.5">
      <span className="text-muted-foreground flex items-start gap-1 text-xs font-normal">
        <LineMarker aria-hidden="true">
          <LockIcon className="size-3" />
        </LineMarker>
        {counted ? (
          <CountLine current={counted.current} glasses={glasses} target={counted.target} />
        ) : (
          <BuddyGlassesHowToEarn glasses={glasses} />
        )}
      </span>

      {counted && (
        <Meter className="w-full max-w-40">
          <MeterFill className="bg-muted-foreground" share={counted.current / counted.target} />
        </Meter>
      )}
    </span>
  );
}

export function BuddyGlassesPicker({
  kind,
  look,
  onChange,
  options,
  value,
}: {
  kind: BuddyKind;
  look: BuddyLook;
  onChange: (glasses: BuddyGlasses) => void;
  options: BuddyGlassesOption[];
  value: BuddyGlasses;
}) {
  const t = useExtracted();

  return (
    <RadioGroup
      aria-label={t("Glasses")}
      className="grid gap-2"
      onValueChange={(next) => {
        const option = options.find((item) => item.glasses === next && item.earned);

        if (option) {
          onChange(option.glasses);
        }
      }}
      value={value}
    >
      {options.map((option) => (
        <RadioGroupOption className={OPTION_CLASS} key={option.glasses}>
          <Buddy
            beltColor={look.beltColor}
            className={cn("size-12", !option.earned && "opacity-40 grayscale")}
            energy={look.energy}
            expression="happy"
            glasses={option.glasses}
            kind={kind}
            studiedToday={look.studiedToday}
          />

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">
              <BuddyGlassesName glasses={option.glasses} />
            </span>
            {!option.earned && <LockedDetail option={option} />}
          </span>

          <RadioGroupItem disabled={!option.earned} value={option.glasses} />
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}
