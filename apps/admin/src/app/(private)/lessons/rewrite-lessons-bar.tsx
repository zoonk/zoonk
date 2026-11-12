"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { formatCount } from "@/lib/format";
import { Button } from "@zoonk/ui/components/button";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { regenerateLessonsAction } from "./_actions/regenerate-lessons";

/** Shown once a model or prompt version is picked: how many lessons it wrote, and a rewrite of them. */
export function RewriteLessonsBar({
  batchSize,
  matching,
  model,
  promptVersion,
}: {
  batchSize: number;
  matching: number;
  model?: string;
  promptVersion?: string;
}) {
  const [started, setStarted] = useState<string | null>(null);
  const batch = formatCount(Math.min(matching, batchSize), "lesson");

  return (
    <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">
          {formatCount(matching, "published lesson")} {matching === 1 ? "matches" : "match"}
        </span>
        <span aria-live="polite" className="text-muted-foreground text-xs empty:hidden">
          {started ? `Started rewriting ${started}.` : null}
          {!started && matching > batchSize
            ? `A rewrite takes the oldest ${batchSize} at a time.`
            : null}
        </span>
      </div>

      {matching > 0 ? (
        <AdminConfirmDialog
          action={regenerateLessonsAction}
          confirmLabel="Rewrite"
          description="They're hidden from learners until the new version passes review. Learners keep their answers."
          onConfirmed={() => setStarted(batch)}
          title={`Rewrite ${batch}?`}
          trigger={
            <Button icon={<RefreshCwIcon aria-hidden="true" />} size="sm" variant="outline">
              Rewrite {batch}
            </Button>
          }
        >
          <input name="model" type="hidden" value={model ?? ""} />
          <input name="promptVersion" type="hidden" value={promptVersion ?? ""} />
        </AdminConfirmDialog>
      ) : null}
    </div>
  );
}
