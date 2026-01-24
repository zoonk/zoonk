"use client";

import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { useExtracted } from "next-intl";
import { AlternativeTitlesFormActions } from "./alternative-titles-form-actions";

export function AlternativeTitlesAddForm({
  addAction,
  error,
  exportPending,
  isAdding,
  onExport,
  onImport,
}: {
  addAction: (payload: FormData) => void;
  error: string | null;
  exportPending: boolean;
  isAdding: boolean;
  onExport: () => void;
  onImport: () => void;
}) {
  const t = useExtracted();

  return (
    <>
      <form action={addAction} className="flex gap-2">
        <Input
          className="h-8 text-sm"
          disabled={isAdding}
          key={isAdding ? "adding" : "idle"}
          name="title"
          placeholder={t("Add alternative title…")}
        />
        <Button disabled={isAdding} size="sm" type="submit">
          {t("Add")}
        </Button>

        <AlternativeTitlesFormActions
          disabled={exportPending}
          onExport={onExport}
          onImport={onImport}
        />
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </>
  );
}
