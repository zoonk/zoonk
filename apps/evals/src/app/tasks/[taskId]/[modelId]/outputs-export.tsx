"use client";

import { Button } from "@zoonk/ui/components/button";
import { downloadFile } from "@zoonk/utils/download";
import { DownloadIcon } from "lucide-react";

export type OutputExportEntry = { input: Record<string, unknown>; output: string };

/**
 * Preserves structured model outputs as JSON values while keeping text outputs
 * exportable.
 */
function parseOutput(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return output;
  }
}

/** Keeps the test-case input beside its output without adding identifying metadata. */
function createAnonymousEntry({ input, output }: OutputExportEntry) {
  return { input, output: parseOutput(output) };
}

/**
 * Downloads each test-case input and generated value without revealing which
 * model produced them.
 */
export function OutputsExport({ entries }: { entries: OutputExportEntry[] }) {
  /** Builds the anonymous payload only when the user requests the download. */
  function exportOutputs() {
    const anonymousEntries = entries.map((entry) => createAnonymousEntry(entry));
    downloadFile(JSON.stringify(anonymousEntries, null, 2), "outputs.json", "application/json");
  }

  return (
    <Button disabled={entries.length === 0} onClick={exportOutputs} type="button" variant="outline">
      <DownloadIcon />
      Export Outputs
    </Button>
  );
}
