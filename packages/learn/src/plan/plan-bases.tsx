"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { PlanBasesSheet, useBasesSheet } from "./plan-bases-sheet";
import { usePlanBases, useSummaryText } from "./use-bases-texts";

export function PlanBases() {
  const t = useExtracted();
  const bases = usePlanBases();
  const summaryText = useSummaryText();
  const sheet = useBasesSheet();

  if (!bases) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2" data-slot="plan-bases">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">{t("Prerequisites")}</h3>
        <p className="text-muted-foreground text-sm text-pretty">{summaryText(bases)}</p>
      </div>
      <Button
        aria-haspopup="dialog"
        className="self-start"
        onClick={sheet.show}
        size="sm"
        variant="outline"
      >
        {t("Change")}
      </Button>
      <PlanBasesSheet bases={bases} onOpenChange={sheet.setOpen} open={sheet.open} />
    </section>
  );
}
