"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { formatCount } from "@/lib/format";
import { Button } from "@zoonk/ui/components/button";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@zoonk/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { parseAsString, useQueryStates } from "nuqs";
import { useState } from "react";
import { regenerateLessonsAction } from "./_actions/regenerate-lessons";

type Option = { label: string; value: string };

function describe({ batchSize, matching }: { batchSize: number; matching: number | null }) {
  if (matching === null) {
    return "Pick the model or the prompt version whose lessons should be written again.";
  }

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

export function RewriteLessonsDialog({
  batchSize,
  matching,
  model,
  modelOptions,
  promptVersion,
  promptVersionOptions,
}: {
  batchSize: number;
  /** Published lessons the picked model and version wrote; none picked yet is `null`. */
  matching: number | null;
  model?: string;
  modelOptions: Option[];
  promptVersion?: string;
  promptVersionOptions: Option[];
}) {
  const [open, setOpen] = useState(false);

  const [, setQuery] = useQueryStates(
    { model: parseAsString, page: parseAsString, promptVersion: parseAsString },
    { shallow: false },
  );

  const batch = Math.min(matching ?? 0, batchSize);

  // The pick narrows the list only while the dialog asks about it.
  function change(next: boolean) {
    setOpen(next);

    if (!next) {
      void setQuery({ model: null, page: null, promptVersion: null });
    }
  }

  return (
    <AdminConfirmDialog
      action={regenerateLessonsAction}
      confirmDisabled={batch === 0}
      confirmLabel={batch > 0 ? `Rewrite ${formatCount(batch, "lesson")}` : "Rewrite"}
      description={describe({ batchSize, matching })}
      onConfirmed={() => showSuccessToast(`Started rewriting ${formatCount(batch, "lesson")}.`)}
      onOpenChange={change}
      open={open}
      title="Rewrite lessons by model"
      trigger={
        <Button size="bar" variant="outline">
          Rewrite by model
        </Button>
      }
    >
      <input name="model" type="hidden" value={model ?? ""} />
      <input name="promptVersion" type="hidden" value={promptVersion ?? ""} />

      <FieldGroup>
        <Field>
          <FieldContent>
            <FieldLabel htmlFor="rewrite-model">Model</FieldLabel>
            <NativeSelect
              id="rewrite-model"
              onChange={(event) =>
                void setQuery({
                  model: event.target.value || null,
                  page: null,
                  promptVersion: null,
                })
              }
              value={model ?? ""}
            >
              <NativeSelectOption value="">All models</NativeSelectOption>
              {modelOptions.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FieldContent>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor="rewrite-version">Prompt version</FieldLabel>
            <NativeSelect
              id="rewrite-version"
              onChange={(event) =>
                void setQuery({ page: null, promptVersion: event.target.value || null })
              }
              value={promptVersion ?? ""}
            >
              <NativeSelectOption value="">All prompt versions</NativeSelectOption>
              {promptVersionOptions.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FieldContent>
        </Field>
      </FieldGroup>
    </AdminConfirmDialog>
  );
}
