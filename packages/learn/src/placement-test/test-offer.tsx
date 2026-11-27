"use client";

import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";
import { FactSegments } from "../_components/task-meta";
import { ChoiceList } from "../onboarding/choice-list";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { useShown } from "./use-test-analytics";

/** The button a save started from, which shows it's busy while the other waits. */
export type TestPressed = "main" | "other" | null;

export type TestOfferRow<Value extends string> = {
  facts?: readonly string[];
  label: string;
  value: Value;
};

type OtherAction = { label: string; onPress: () => void };

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

/**
 * Where a test is offered beside another way to start: each way is a row with its facts, one comes
 * picked, and the main action starts the picked one.
 */
export function TestOffer<Value extends string>({
  description,
  failed,
  initial,
  mainLabel,
  onShown,
  onStart,
  other,
  pressed,
  rows,
  title,
}: {
  description: string;
  failed: boolean;
  initial: Value;
  /** The main action's label for the picked row; "Start" when omitted. */
  mainLabel?: (value: Value) => string;
  /** The offer is on screen. */
  onShown?: () => void;
  onStart: (value: Value) => void;
  other?: OtherAction;
  pressed: TestPressed;
  rows: readonly TestOfferRow<Value>[];
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
        <OnboardingDescription>{description}</OnboardingDescription>
      </OnboardingHeading>

      <ChoiceList
        choices={rows.map((row) => ({
          description: row.facts && row.facts.length > 0 && <FactSegments facts={row.facts} />,
          label: row.label,
          value: row.value,
        }))}
        label={title}
        onChange={setPicked}
        readOnly={pressed !== null}
        value={picked}
      />
    </OnboardingColumn>
  );
}

/** One test and nothing to pick: what it is, its facts beside its name, and the way in. */
export function TestInvitation({
  children,
  chip,
  description,
  facts,
  failed,
  mainLabel,
  onShown,
  onStart,
  other,
  pressed,
  title,
}: {
  children?: ReactNode;
  chip: string;
  description?: string;
  facts: readonly string[];
  failed: boolean;
  mainLabel?: string;
  /** The offer is on screen. */
  onShown?: () => void;
  onStart: () => void;
  other?: OtherAction;
  pressed: TestPressed;
  title: string;
}) {
  const t = useExtracted();
  useShown(onShown);

  return (
    <OnboardingColumn
      bar={
        <OfferActions
          failed={failed}
          mainLabel={mainLabel ?? t("Start")}
          onMain={onStart}
          other={other}
          pressed={pressed}
        />
      }
    >
      <OnboardingHeading>
        <OnboardingSubject position={facts}>{chip}</OnboardingSubject>
        <OnboardingTitle>{title}</OnboardingTitle>
        {description && <OnboardingDescription>{description}</OnboardingDescription>}
      </OnboardingHeading>
      {children}
    </OnboardingColumn>
  );
}
