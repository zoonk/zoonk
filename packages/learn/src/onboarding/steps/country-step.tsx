"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowTitle,
} from "../../_components/list-group";
import { StatusRegion } from "../../_components/status-region";
import {
  type CountryChoice,
  type CountryName,
  type SuggestedCountry,
} from "../../country/country-choice";
import { CountryPicker } from "../../country/country-picker";
import { useLessonLanguageLine } from "../../country/use-country-lines";
import { type Choice, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";

/** A country picked from the full list comes back as the first row, so the pick stays in view. */
function getRows({
  defaultCountry,
  other,
  suggested,
}: {
  defaultCountry: CountryName | null;
  other: CountryChoice | null;
  suggested: readonly SuggestedCountry[];
}): CountryChoice[] {
  const listed: CountryChoice[] = [...suggested];

  if (listed.length === 0 && defaultCountry) {
    // The language's own country, where lessons read as they always do.
    listed.push({ ...defaultCountry, lessonVariety: null });
  }

  return other && !listed.some((country) => country.code === other.code)
    ? [other, ...listed]
    : listed;
}

function CountryNotice({ picked }: { picked: CountryChoice | null }) {
  const lessonLanguage = useLessonLanguageLine()(picked?.lessonVariety ?? null);

  return <StatusRegion className="text-muted-foreground text-sm">{lessonLanguage}</StatusRegion>;
}

/**
 * Picking doesn't move on, unlike the other one-answer steps: a mis-tap would start a course about
 * the wrong country. Skip uses the language's own country and is never asked again.
 */
export function CountryStep({
  defaultCountry,
  language,
  onAnswer,
  pending,
  subject,
  suggested,
}: {
  defaultCountry: CountryName | null;
  language: string;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
  suggested: readonly SuggestedCountry[];
}) {
  const t = useExtracted();
  const [other, setOther] = useState<CountryChoice | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pickedInPicker = useRef(false);
  const rows = getRows({ defaultCountry, other, suggested });
  const picked = rows.find((country) => country.code === code) ?? null;

  const choices: Choice<string>[] = rows.map((country) => ({
    label: country.name,
    value: country.code,
  }));

  return (
    <StepForm
      canContinue={picked !== null}
      notice={<CountryNotice picked={picked} />}
      onContinue={() => picked && onAnswer({ country: picked.code, question: "contentCountry" })}
      onSkip={() => onAnswer({ country: null, question: "contentCountry" })}
      pending={pending}
      subject={subject}
      title={t("Which country should your lessons be about?")}
    >
      <ListGroup>
        <div className="contents" ref={listRef}>
          <ChoiceList
            choices={choices}
            label={t("Country")}
            onChange={setCode}
            readOnly={pending}
            value={code}
          />
        </div>

        <ListRowButton
          aria-haspopup="dialog"
          disabled={pending}
          onClick={() => setPickerOpen(true)}
        >
          {/* Lines its name up with the countries', which start after their number keys. */}
          <span aria-hidden="true" className="hidden w-5 shrink-0 pointer-fine:block" />
          <ListRowContent>
            <ListRowTitle>{t("Another country")}</ListRowTitle>
          </ListRowContent>
        </ListRowButton>
      </ListGroup>

      <CountryPicker
        // A country picked here becomes the list's checked row; focusing it says which one it is.
        finalFocus={() => {
          const fromPicker = pickedInPicker.current;
          pickedInPicker.current = false;

          return (
            (fromPicker &&
              listRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')) ||
            true
          );
        }}
        language={language}
        onOpenChange={setPickerOpen}
        onPick={(country) => {
          pickedInPicker.current = true;
          setOther(country);
          setCode(country.code);
          setPickerOpen(false);
        }}
        open={pickerOpen}
        suggested={suggested}
        title={t("Country")}
        value={code}
      />
    </StepForm>
  );
}
