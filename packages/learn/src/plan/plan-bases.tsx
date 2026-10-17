"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { PlanBasesSheet } from "./plan-bases-sheet";
import { usePlanBases, useSummaryText } from "./use-bases-texts";

/**
 * The prerequisites in the focus sheet and the plan editor: how many there are and the time they
 * take, with "Choose" opening their sheet, where the app recommends how to study them when the
 * learner asks. Only for plans with prerequisites to choose for.
 */
export function PlanBases() {
  const t = useExtracted();
  const bases = usePlanBases();
  const summaryText = useSummaryText();
  const [open, setOpen] = useState(false);

  if (!bases) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2" data-slot="plan-bases">
      <h3 className="text-sm font-medium">{t("Prerequisites")}</h3>
      <p className="text-muted-foreground text-sm text-pretty">{summaryText(bases)}</p>
      <Button className="self-start" onClick={() => setOpen(true)} size="sm" variant="outline">
        {t("Choose prerequisites")}
      </Button>
      <PlanBasesSheet bases={bases} onOpenChange={setOpen} open={open} />
    </section>
  );
}
