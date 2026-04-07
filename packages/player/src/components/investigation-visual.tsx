"use client";

import { type VisualStepContent } from "@zoonk/core/steps/contract/visual";
import { Dialog, DialogContent, DialogTitle } from "@zoonk/ui/components/dialog";
import { MaximizeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { StepVisualRenderer } from "./step-visual-renderer";

/**
 * Renders a visual at a compact height for investigation steps.
 * Shows a clipped preview with a fade gradient and "View full" hint.
 * Tapping opens a dialog with the full-size visual so the learner
 * can study details without layout shift in the main view.
 */
export function InvestigationVisual({ content }: { content: VisualStepContent }) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={t("View full evidence")}
        className="group relative max-h-35 w-full cursor-pointer overflow-hidden rounded-lg md:max-h-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        <StepVisualRenderer content={content} />

        <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t to-transparent" />

        <div className="bg-background/80 absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 py-1.5 supports-backdrop-filter:backdrop-blur-sm">
          <MaximizeIcon className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground text-xs font-medium">{t("View full")}</span>
        </div>
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogTitle className="sr-only">{t("Evidence")}</DialogTitle>

          <div className="max-h-[70dvh] overflow-y-auto">
            <StepVisualRenderer content={content} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
