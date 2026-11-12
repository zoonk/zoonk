"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { type RegionChoice, getVarietyNameInSentence } from "@zoonk/utils/language-regions";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { useAppLocale } from "../_utils/locale";
import { findTaughtRegion, useVarietyNote } from "./use-variety-words";

const NO_COUNTRY = "";

/** A language goal's country, or none, with what the choice changes said under it. */
export function CountryField({
  autoFocus = false,
  choices,
  disabled = false,
  id,
  language,
  onChange,
  onKeyDown,
  value,
}: {
  autoFocus?: boolean;
  choices: readonly RegionChoice[];
  disabled?: boolean;
  id: string;
  language: string;
  onChange: (region: string | null) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLSelectElement>;
  value: string | null;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const noteId = useId();
  const varietyNote = useVarietyNote();
  const taughtRegion = findTaughtRegion(choices);
  const note = varietyNote({ language, region: value, taughtRegion });

  return (
    <>
      <NativeSelect
        aria-describedby={noteId}
        autoFocus={autoFocus}
        className="w-full"
        disabled={disabled}
        focusableWhenDisabled
        id={id}
        onChange={(event) => onChange(event.target.value || null)}
        onKeyDown={onKeyDown}
        value={value ?? NO_COUNTRY}
      >
        <NativeSelectOption value={NO_COUNTRY}>{t("No preference")}</NativeSelectOption>

        {choices.map((choice) => (
          <NativeSelectOption key={choice.code} value={choice.code}>
            {choice.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <p className="text-muted-foreground text-sm text-pretty" id={noteId}>
        {note ??
          t({
            description:
              "{taughtVariety} is a language with a country, written as it reads inside a sentence, such as “Spanish (Mexico)”.",
            message:
              "Your buddy and practice calls use the country you choose. Lessons and their audio use {taughtVariety}.",
            values: {
              taughtVariety: getVarietyNameInSentence({
                language,
                region: taughtRegion,
                userLanguage: locale,
              }),
            },
          })}
      </p>
    </>
  );
}
