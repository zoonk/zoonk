"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { type RegionChoice } from "@zoonk/utils/language-regions";
import { useExtracted } from "next-intl";
import { useId } from "react";
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
  const noteId = useId();
  const varietyNote = useVarietyNote();
  const note = varietyNote({ language, region: value, taughtRegion: findTaughtRegion(choices) });

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
            {choice.taught ? `${choice.name} · ${t("Lessons use this variety")}` : choice.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <p className="text-muted-foreground text-sm text-pretty" id={noteId}>
        {note ??
          t("Your buddy and practice calls use the country you choose. Lessons stay the same.")}
      </p>
    </>
  );
}
