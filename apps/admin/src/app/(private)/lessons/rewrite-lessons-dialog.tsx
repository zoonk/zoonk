"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { formatCount } from "@/lib/format";
import { Button } from "@zoonk/ui/components/button";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { regenerateLessonsAction } from "./_actions/regenerate-lessons";

type Scope = { model?: string; promptVersion?: string };

function title({ model, promptVersion }: Scope) {
  if (model && promptVersion) {
    return `Rewrite lessons written by ${model} with prompt version ${promptVersion}?`;
  }

  return model
    ? `Rewrite lessons written by ${model}?`
    : `Rewrite lessons written with prompt version ${promptVersion}?`;
}

function describe({ batchSize, matching }: { batchSize: number; matching: number }) {
  if (matching === 0) {
    return "No published lesson matches.";
  }

  const all = formatCount(matching, "published lesson");

  const scope =
    matching > batchSize
      ? `${all} match. This rewrites the oldest ${batchSize}`
      : `${all} ${matching === 1 ? "matches" : "match"}. This rewrites ${matching === 1 ? "it" : "them"}`;

  return `${scope}: they leave play until the new version passes the checks. Learners keep their answers.`;
}

/** Confirms a rewrite of what the list's model and prompt version filters already show. */
export function RewriteLessonsDialog({
  batchSize,
  matching,
  model,
  promptVersion,
}: Scope & {
  batchSize: number;
  /** Published lessons the picked model and version wrote. */
  matching: number;
}) {
  const batch = Math.min(matching, batchSize);

  return (
    <AdminConfirmDialog
      action={regenerateLessonsAction}
      confirmDisabled={batch === 0}
      confirmLabel={batch > 0 ? `Rewrite ${formatCount(batch, "lesson")}` : "Rewrite"}
      description={describe({ batchSize, matching })}
      onConfirmed={() => showSuccessToast(`Started rewriting ${formatCount(batch, "lesson")}.`)}
      title={title({ model, promptVersion })}
      trigger={
        <Button size="bar" variant="outline">
          Rewrite lessons
        </Button>
      }
    >
      <input name="model" type="hidden" value={model ?? ""} />
      <input name="promptVersion" type="hidden" value={promptVersion ?? ""} />
    </AdminConfirmDialog>
  );
}
