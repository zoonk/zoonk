"use client";

import { type EvalSummary } from "@/lib/eval-summary";
import { type ReviewExportEntry } from "@/lib/review-export";
import { Button } from "@zoonk/ui/components/button";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { FileTextIcon, PrinterIcon } from "lucide-react";
import { useState } from "react";
import { printReviewOutputs } from "./review-print-document";

function getLanguageLabel(language: string): string {
  return language === "other" ? "Other" : language.toUpperCase();
}

export function ReviewPdfExport({
  entries,
  taskName,
  summary,
  modelId,
  taskId,
}: {
  entries: ReviewExportEntry[];
  taskName: string;
  summary: EvalSummary;
  modelId: string;
  taskId: string;
}) {
  const languages = [...new Set(entries.map((entry) => entry.language))].toSorted();
  const [selectedLanguages, setSelectedLanguages] = useState(languages);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selectedEntries = entries.filter((entry) => selectedLanguages.includes(entry.language));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setError(null);
    }
  }

  function handleLanguageChange({ checked, language }: { checked: boolean; language: string }) {
    setSelectedLanguages((currentLanguages) =>
      checked
        ? [...currentLanguages, language].toSorted()
        : currentLanguages.filter((currentLanguage) => currentLanguage !== language),
    );
  }

  function printReview() {
    setError(null);

    try {
      const opened = printReviewOutputs({
        entries: selectedEntries,
        modelId,
        summary,
        taskId,
        taskName,
      });

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
    <Drawer onOpenChange={handleOpenChange} open={open}>
      <DrawerTrigger
        render={
          <Button disabled={summary.attempted === 0} size="sm" type="button" variant="outline" />
        }
      >
        <FileTextIcon />
        <span className="sr-only sm:not-sr-only">Export review PDF</span>
      </DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader closeLabel="Close">
          <DrawerTitle>Export review PDF</DrawerTitle>
          <DrawerDescription>
            Pick the languages to include. A test case that ran more than once shows its
            lowest-scoring output. Your browser&apos;s print dialog saves it as a PDF.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-4 pt-2">
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">Output languages</legend>
            {languages.map((language) => {
              const outputCount = entries.filter((entry) => entry.language === language).length;

              return (
                <label
                  className="hover:bg-muted/60 -mx-2.5 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors"
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
            <p className="text-destructive-text text-sm" role="alert">
              {error}
            </p>
          )}
        </DrawerContent>

        <DrawerFooter>
          <Button
            disabled={entries.length > 0 && selectedEntries.length === 0}
            onClick={printReview}
            size="lg"
          >
            <PrinterIcon />
            Print or save PDF
          </Button>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}
