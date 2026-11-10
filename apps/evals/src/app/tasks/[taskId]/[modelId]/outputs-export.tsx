"use client";

import { type EvalSummary, HISTORICAL_ATTEMPTS_NOTE } from "@/lib/eval-summary";
import { type FailedRun, type KeyFlaw } from "@/lib/types";
import { Button } from "@zoonk/ui/components/button";
import { downloadFile } from "@zoonk/utils/download";
import { DownloadIcon } from "lucide-react";

export type OutputExportEntry = {
  input: Record<string, unknown>;
  output: string;
  testCaseId: string;
  keyFlaws?: KeyFlaw[];
  itemsScored?: number;
};

function parseOutput(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return output;
  }
}

function createAnonymousEntry({ output, ...entry }: OutputExportEntry) {
  return {
    ...entry,
    href: `#case-${encodeURIComponent(entry.testCaseId)}`,
    keyFlaws: entry.keyFlaws ?? "not recorded",
    output: parseOutput(output),
  };
}

export function OutputsExport({
  entries,
  summary,
  failedRuns,
}: {
  entries: OutputExportEntry[];
  summary: EvalSummary;
  failedRuns: FailedRun[];
}) {
  function exportOutputs() {
    const anonymousEntries = entries.map((entry) => createAnonymousEntry(entry));

    const exported = {
      averageScoreCovers: "scored outputs",
      failedRuns: failedRuns.map((run) => ({
        href: `#case-${encodeURIComponent(run.testCaseId)}`,
        message: run.message ?? "not recorded",
        reason: run.reason ?? "unknown",
        testCaseId: run.testCaseId,
      })),
      keyFlawsLabel: "judge-flagged",
      note: HISTORICAL_ATTEMPTS_NOTE,
      outputs: anonymousEntries,
      summary,
    };

    downloadFile(JSON.stringify(exported, null, 2), "outputs.json", "application/json");
  }

  return (
    <Button
      disabled={summary.attempted === 0}
      onClick={exportOutputs}
      type="button"
      variant="outline"
    >
      <DownloadIcon />
      Export Outputs
    </Button>
  );
}
