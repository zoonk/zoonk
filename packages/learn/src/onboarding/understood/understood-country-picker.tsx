"use client";

import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { PencilIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../../_components/save-error";
import { CountryPicker } from "../../country/country-picker";
import { type UnderstoodRow as Row } from "./use-understood-rows";

/** Nothing is built yet, so a pick saves on the draft at once, without asking. */
export function CountryRowPicker({
  onSave,
  row,
}: {
  onSave: (value: string) => Promise<boolean>;
  row: Row;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, startSaving] = useTransition();

  if (!row.contentCountry) {
    return null;
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={t("Edit {field}", { field: row.label })}
        className="text-muted-foreground -my-1.5 -mr-2 shrink-0 focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover/fact:opacity-100"
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        size="icon"
        variant="ghost"
      >
        <PencilIcon aria-hidden="true" />
      </Button>

      <CountryPicker
        onOpenChange={setOpen}
        onPick={(country) => {
          if (!country || country.code === row.contentCountry?.code) {
            setOpen(false);
            return;
          }

          setFailed(false);

          startSaving(async () => {
            const { data: saved } = await safeAsync(() => onSave(country.code));

            startSaving(() => {
              setFailed(!saved);
              setOpen(!saved);
            });
          });
        }}
        open={open}
        suggested={row.contentCountry.suggested}
        title={t("Country")}
        value={row.contentCountry.code}
      >
        {failed && <ChangeSaveError />}
      </CountryPicker>
    </>
  );
}
