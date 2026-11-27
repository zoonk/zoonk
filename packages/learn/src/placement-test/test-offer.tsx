"use client";

import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { KindIcon } from "../_components/kind-tile";
import { useFormatDuration } from "../_utils/time-format";
import { CHOICE_CARD_PICKED_CLASS } from "../onboarding/choice-styles";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { useShown } from "./use-test-analytics";

/** The button a save started from, which shows it's busy while the other waits. */
export type TestPressed = "main" | "other" | null;

/** One way to start: a test with its size and time, or the first lesson by its name. */
export type TestOfferCard<Value extends string> = {
  label: string;
  /** One quiet line under the name: the most questions a test asks, a lesson's name. */
  line?: string | null;
  /** A lesson's mark, or a test's in its kind's hue. */
  mark: "lesson" | "test";
  /** How long it takes, as the card's readout. */
  minutes?: number | null;
  value: Value;
};

type OtherAction = { label: string; onPress: () => void };

const CARD_CLASS = "ring-input flex items-center gap-4 rounded-xl p-4 ring-1 ring-inset";

const CARD_OPTION_CLASS = cn(
  CARD_CLASS,
  "has-focus-visible:ring-ring/50 has-focus-visible:has-data-checked:ring-ring/50 cursor-pointer leading-normal font-normal has-focus-visible:ring-[3px] has-data-checked:ring-transparent",
  CHOICE_CARD_PICKED_CLASS,
);

function CardFace<Value extends string>({ card }: { card: TestOfferCard<Value> }) {
  const formatDuration = useFormatDuration();

  return (
    <>
      <KindIcon className="size-5 self-start" kind={card.mark === "test" ? "mock" : "lesson"} />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-reading font-medium wrap-break-word">{card.label}</span>
        {card.line && (
          <span className="text-muted-foreground text-xs wrap-break-word">{card.line}</span>
        )}
      </span>

      {card.minutes ? (
        <BigQuantity className="shrink-0 text-2xl">{formatDuration(card.minutes)}</BigQuantity>
      ) : null}
    </>
  );
}

function OfferActions({
  failed,
  mainLabel,
  onMain,
  other,
  pressed,
}: {
  failed: boolean;
  mainLabel: string;
  onMain: () => void;
  other?: OtherAction;
  pressed: TestPressed;
}) {
  return (
    <OnboardingActions failed={failed}>
      {other && (
        <OnboardingSecondaryButton
          busy={pressed === "other"}
          disabled={pressed === "main"}
          onClick={other.onPress}
        >
          {other.label}
        </OnboardingSecondaryButton>
      )}
      <OnboardingPrimaryButton
        busy={pressed === "main"}
        disabled={pressed === "other"}
        onClick={onMain}
      >
        {mainLabel}
      </OnboardingPrimaryButton>
    </OnboardingActions>
  );
}

function OfferCards<Value extends string>({
  cards,
  label,
  onChange,
  readOnly,
  value,
}: {
  cards: readonly TestOfferCard<Value>[];
  label: string;
  onChange: (value: Value) => void;
  readOnly: boolean;
  value: Value;
}) {
  useNumberKeys({
    count: cards.length,
    enabled: !readOnly && cards.length > 1,
    onPick: (index) => {
      const card = cards[index];

      if (!card) {
        return false;
      }

      onChange(card.value);
    },
  });

  const [only] = cards;

  if (only && cards.length === 1) {
    return (
      <div className={CARD_CLASS} data-slot="test-offer-card">
        <CardFace card={only} />
      </div>
    );
  }

  return (
    <RadioGroup
      aria-label={label}
      className="gap-2"
      onValueChange={(next) => {
        const card = cards.find((item) => item.value === next);

        if (card) {
          onChange(card.value);
        }
      }}
      readOnly={readOnly}
      value={value}
    >
      {cards.map((card, index) => (
        <RadioGroupOption
          className={CARD_OPTION_CLASS}
          data-slot="test-offer-card"
          key={card.value}
        >
          <CardFace card={card} />
          <RadioGroupItem aria-keyshortcuts={shortcutKeys("pick", index)} value={card.value} />
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}

/**
 * Where a test is offered: each way to start is a card with its mark, and a test's card says how
 * many questions it asks and how long it takes. With two cards one comes picked and the main
 * action starts the picked one; a test offered alone is its card and the way in.
 */
export function TestOffer<Value extends string>({
  cards,
  description,
  failed,
  initial,
  mainLabel,
  onShown,
  onStart,
  other,
  pressed,
  title,
}: {
  cards: readonly TestOfferCard<Value>[];
  description?: string;
  failed: boolean;
  initial: Value;
  /** The main action's label for the picked card; "Start" when omitted. */
  mainLabel?: (value: Value) => string;
  /** The offer is on screen. */
  onShown?: () => void;
  onStart: (value: Value) => void;
  other?: OtherAction;
  pressed: TestPressed;
  title: string;
}) {
  const t = useExtracted();
  const [picked, setPicked] = useState(initial);
  useShown(onShown);

  return (
    <OnboardingColumn
      bar={
        <OfferActions
          failed={failed}
          mainLabel={mainLabel?.(picked) ?? t("Start")}
          onMain={() => onStart(picked)}
          other={other}
          pressed={pressed}
        />
      }
    >
      <OnboardingHeading>
        <OnboardingTitle>{title}</OnboardingTitle>
        {description && <OnboardingDescription>{description}</OnboardingDescription>}
      </OnboardingHeading>

      <OfferCards
        cards={cards}
        label={title}
        onChange={setPicked}
        readOnly={pressed !== null}
        value={picked}
      />
    </OnboardingColumn>
  );
}
