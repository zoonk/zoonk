"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { NativeSelectButton } from "@zoonk/ui/components/native-select";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import { type CountryChoice } from "../country/country-choice";
import { CountryPicker } from "../country/country-picker";
import { useLessonLanguageLine } from "../country/use-country-lines";
import { type PlanContentCountry, usePlanScreen } from "./plan-context";

function ChangeCountryDialog({
  country,
  onCancel,
  onConfirm,
  saving,
}: {
  country: CountryChoice | null;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const t = useExtracted();

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open && !saving) {
          onCancel();
        }
      }}
      open={country !== null}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Change your country?")}</AlertDialogTitle>
          <AlertDialogDescription className="max-h-[50dvh] overflow-y-auto">
            {t({
              description:
                "{country} is a country's name. It always follows the colon, so it never needs an article or a case.",
              message:
                "New country: {country}. We'll make a new plan for it. Finished lessons stay done.",
              values: { country: country?.name ?? "" },
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t("Cancel")}</AlertDialogCancel>
          <form action={onConfirm} className="contents">
            <AlertDialogAction busy={saving} type="submit">
              {t("Change country")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A new country rebuilds the plan, so it asks first; the picker stays open behind the question,
 * with the old country still picked, until the new one saves.
 */
function ContentCountryControl({ country }: { country: PlanContentCountry }) {
  const t = useExtracted();
  const lessonLanguage = useLessonLanguageLine()(country.lessonVariety);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<CountryChoice | null>(null);
  const saveFailed = useChangeSaveFailed();
  const [saving, startSaving] = useTransition();
  const titleId = useId();
  const valueId = useId();

  const pick = (picked: CountryChoice | null) => {
    if (!picked || picked.code === country.code) {
      setOpen(false);
      return;
    }

    setAsking(picked);
  };

  const confirm = () => {
    if (!asking) {
      return;
    }

    const { code } = asking;

    startSaving(async () => {
      const { data: saved } = await safeAsync(() => country.onChange(code));

      // Updates after an `await` join the transition only when started in one again.
      startSaving(() => {
        setAsking(null);

        if (saved) {
          setOpen(false);
        } else {
          saveFailed();
        }
      });
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium" id={titleId}>
        {t("Country")}
      </h3>

      <NativeSelectButton
        aria-haspopup="dialog"
        aria-labelledby={`${titleId} ${valueId}`}
        onClick={() => setOpen(true)}
      >
        <span id={valueId}>{country.name}</span>
      </NativeSelectButton>

      {lessonLanguage && <p className="text-muted-foreground text-sm">{lessonLanguage}</p>}

      <CountryPicker
        language={country.language}
        onOpenChange={setOpen}
        onPick={pick}
        open={open}
        suggested={country.suggested}
        title={t("Country")}
        value={country.code}
      />

      <ChangeCountryDialog
        country={asking}
        onCancel={() => setAsking(null)}
        onConfirm={confirm}
        saving={saving}
      />
    </section>
  );
}

/** The editor's country section: only a country the learner can change has one. */
export function PlanCountry() {
  const { contentCountry } = usePlanScreen().goal;

  if (!contentCountry?.editable) {
    return null;
  }

  return <ContentCountryControl country={contentCountry} />;
}
