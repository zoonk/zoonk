"use client";

import { type ReviewExportEntry } from "@/lib/review-export";
import { Button } from "@zoonk/ui/components/button";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zoonk/ui/components/dialog";
import { FileTextIcon, PrinterIcon } from "lucide-react";
import { useState } from "react";
import { printReviewOutputs } from "./review-print-document";

/** Labels the fallback bucket naturally while keeping language codes compact. */
function getLanguageLabel(language: string): string {
  return language === "other" ? "Other" : language.toUpperCase();
}

/**
 * Lets reviewers choose language slices while explaining that repeated runs are
 * reduced to each test case's lowest-scoring output before the print view opens.
 */
export function ReviewPdfExport({
  entries,
  taskName,
}: {
  entries: ReviewExportEntry[];
  taskName: string;
}) {
  const languages = [...new Set(entries.map((entry) => entry.language))].toSorted();
  const [selectedLanguages, setSelectedLanguages] = useState(languages);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selectedEntries = entries.filter((entry) => selectedLanguages.includes(entry.language));

  /** Resets stale export errors whenever the language picker opens again. */
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setError(null);
    }
  }

  /** Adds or removes one language without disturbing the review order of its outputs. */
  function handleLanguageChange({ checked, language }: { checked: boolean; language: string }) {
    setSelectedLanguages((currentLanguages) =>
      checked
        ? [...currentLanguages, language].toSorted()
        : currentLanguages.filter((currentLanguage) => currentLanguage !== language),
    );
  }

  /** Opens a print-only window containing only the chosen language entries. */
  function printReview() {
    setError(null);

    try {
      const opened = printReviewOutputs({ entries: selectedEntries, taskName });

      if (!opened) {
        setError("The print window was blocked. Allow pop-ups and try again.");
        return;
      }

      setOpen(false);
    } catch {
      setError("The review could not be prepared. Try again.");
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={<Button disabled={entries.length === 0} type="button" variant="outline" />}
      >
        <FileTextIcon />
        Export review PDF
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export review PDF</DialogTitle>
          <DialogDescription>
            Choose the output languages to include. For repeated runs, the PDF uses the
            lowest-scoring output when scores are available. Otherwise, it includes one generated
            output per test case. A print dialog will open, where you can save the review as a PDF.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Output languages</legend>
          {languages.map((language) => {
            const outputCount = entries.filter((entry) => entry.language === language).length;

            return (
              <label
                className="hover:bg-muted/60 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors"
                key={language}
              >
                <Checkbox
                  checked={selectedLanguages.includes(language)}
                  onCheckedChange={(checked) => handleLanguageChange({ checked, language })}
                />
                <span className="font-medium">{getLanguageLabel(language)}</span>
                <span className="text-muted-foreground ml-auto text-sm">
                  {outputCount} {outputCount === 1 ? "output" : "outputs"}
                </span>
              </label>
            );
          })}
        </fieldset>

        <p aria-live="polite" className="text-muted-foreground text-sm">
          {selectedEntries.length} {selectedEntries.length === 1 ? "output" : "outputs"} selected
        </p>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <DialogFooter showCloseButton>
          <Button disabled={selectedEntries.length === 0} onClick={printReview}>
            <PrinterIcon />
            Print or save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
