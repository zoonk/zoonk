"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
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
      <AlertDialogContent overNested>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Change the content country?")}</AlertDialogTitle>
          <AlertDialogDescription className="max-h-[50dvh] overflow-y-auto">
            {t({
              description:
                "{country} is a country's name. It always follows the colon, so it never needs an article or a case.",
              message:
                "New country: {country}. Your plan will be rebuilt for it. The lessons you've finished stay done, and you can keep studying your current plan until the new one is ready.",
              values: { country: country?.name ?? "" },
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t("Cancel")}</AlertDialogCancel>
          <form action={onConfirm} className="contents">
            <Button busy={saving} type="submit">
              {t("Rebuild plan")}
            </Button>
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
  const [failed, setFailed] = useState(false);
  const [saving, startSaving] = useTransition();

  const pick = (picked: CountryChoice | null) => {
    setFailed(false);

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
        setFailed(!saved);
        setOpen(!saved);
      });
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("Content country")}</h3>

      <Button
        aria-haspopup="dialog"
        className="h-auto min-h-9 justify-between py-1.5 text-left whitespace-normal"
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        type="button"
        variant="outline"
      >
        <span className="min-w-0 text-pretty">{country.name}</span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground" />
      </Button>

      {lessonLanguage && <p className="text-muted-foreground text-sm">{lessonLanguage}</p>}

      <CountryPicker
        language={country.language}
        onOpenChange={setOpen}
        onPick={pick}
        open={open}
        overNested
        suggested={country.suggested}
        title={t("Country")}
        value={country.code}
      >
        {failed && <ChangeSaveError />}
      </CountryPicker>

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
