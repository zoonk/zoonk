"use client";

import {
  WizardDescription,
  WizardField,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useEffect } from "react";

const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
  { label: "Español", value: "es" },
  { label: "Português", value: "pt" },
] as const;

type LanguageStepProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LanguageStep({ value, onChange }: LanguageStepProps) {
  const t = useExtracted();

  const currentIndex = LANGUAGE_OPTIONS.findIndex((opt) => opt.value === value);

  const selectNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
    onChange(LANGUAGE_OPTIONS[nextIndex].value);
  }, [currentIndex, onChange]);

  const selectPrevious = useCallback(() => {
    const prevIndex =
      (currentIndex - 1 + LANGUAGE_OPTIONS.length) % LANGUAGE_OPTIONS.length;
    onChange(LANGUAGE_OPTIONS[prevIndex].value);
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
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            className={cn(
              "flex items-center justify-between rounded-lg px-4 py-4 text-left font-semibold text-lg transition-colors",
              value === option.value
                ? "bg-foreground text-background"
                : "hover:bg-muted",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}

            {value === option.value && (
              <CheckIcon aria-hidden="true" className="size-5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
