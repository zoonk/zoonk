"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { SettingRow } from "../_components/setting-rows";
import { useAppLocale } from "../_utils/locale";
import { type CountryName, type SuggestedCountry } from "../country/country-choice";
import { CountryPicker } from "../country/country-picker";

/**
 * Nothing rebuilds, so a pick saves at once and closes. The country starts as where the learner
 * signed in from; "Not set" shows only when that wasn't known.
 */
export function HomeCountrySetting({
  onChange,
  suggested,
  value,
}: {
  onChange: (country: CountryName) => void;
  suggested: readonly SuggestedCountry[];
  value: CountryName | null;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const labelId = useId();
  const descriptionId = useId();
  const valueId = useId();
  const [open, setOpen] = useState(false);
  const title = t("Where you live");

  return (
    <SettingRow
      description={t("So examples and exams match your country.")}
      descriptionId={descriptionId}
      label={<span id={labelId}>{title}</span>}
    >
      <Button
        aria-describedby={descriptionId}
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${valueId}`}
        className="h-auto min-h-7.5 max-w-48 py-1 text-left whitespace-normal"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <span className="min-w-0 text-pretty" id={valueId}>
          {value?.name ?? t("Not set")}
        </span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground" />
      </Button>

      <CountryPicker
        language={locale}
        onOpenChange={setOpen}
        onPick={(country) => {
          setOpen(false);

          if (country.code !== value?.code) {
            onChange(country);
          }
        }}
        open={open}
        suggested={suggested}
        title={title}
        value={value?.code ?? null}
      />
    </SettingRow>
  );
}
