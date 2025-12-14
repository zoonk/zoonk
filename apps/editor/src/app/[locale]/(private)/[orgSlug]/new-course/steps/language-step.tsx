"use client";

import {
  WizardDescription,
  WizardField,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { cn } from "@zoonk/ui/lib/utils";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@zoonk/utils/locale";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useEffect } from "react";

type LanguageStepProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LanguageStep({ value, onChange }: LanguageStepProps) {
  const t = useExtracted();

  const currentIndex = SUPPORTED_LOCALES.indexOf(value as SupportedLocale);

  const selectNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length;
    onChange(SUPPORTED_LOCALES[nextIndex]);
  }, [currentIndex, onChange]);

  const selectPrevious = useCallback(() => {
    const prevIndex =
      (currentIndex - 1 + SUPPORTED_LOCALES.length) % SUPPORTED_LOCALES.length;
    onChange(SUPPORTED_LOCALES[prevIndex]);
  }, [currentIndex, onChange]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectNext();
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectPrevious();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectNext, selectPrevious]);

  return (
    <div className="flex flex-col gap-4">
      <WizardField>
        <WizardLabel>{t("COURSE LANGUAGE")}</WizardLabel>
        <WizardDescription>
          {t("Select the language your course content will be in")}
        </WizardDescription>
      </WizardField>

      <div className="flex flex-col">
        {SUPPORTED_LOCALES.map((locale) => (
          <button
            className={cn(
              "flex items-center justify-between rounded-lg px-4 py-4 text-left font-semibold text-lg transition-colors",
              value === locale
                ? "bg-foreground text-background"
                : "hover:bg-muted",
            )}
            key={locale}
            onClick={() => onChange(locale)}
            type="button"
          >
            {LOCALE_LABELS[locale]}

            {value === locale && (
              <CheckIcon aria-hidden="true" className="size-5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
