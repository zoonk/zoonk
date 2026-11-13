"use client";

import { MAX_MEMORY_STATEMENT_LENGTH } from "@zoonk/core/memory/memory-limits";
import { MAX_CONDITION_NOTE_LENGTH } from "@zoonk/core/profile/questions/contract";
import { Button } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { CheckList } from "../onboarding/choice-list";
import { TextField } from "../onboarding/steps/text-field";
import { type BodyProps, setText, usePicker } from "./profile-body-parts";

function changedRow(previous: readonly string[], next: readonly string[]): string | undefined {
  return next.find((id) => !previous.includes(id)) ?? previous.find((id) => !next.includes(id));
}

function RowsBody(props: BodyProps & { label: string }) {
  const { draft, question } = props;
  const picker = usePicker(props);

  return (
    <CheckList
      choices={question.options.map((option) => ({
        description: option.description ?? undefined,
        label: option.label,
        value: option.id,
      }))}
      label={props.label}
      onChange={(next) => {
        const changed = changedRow(draft.picks, next);

        if (changed) {
          picker.toggle(changed);
        }
      }}
      value={draft.picks}
    />
  );
}

export function ConditionsBody(props: BodyProps & { label: string }) {
  const t = useExtracted();
  const { draft } = props;

  return (
    <>
      <RowsBody {...props} />

      {draft.picks.includes("other") && (
        <TextField
          autoFocus={!props.question.saved.picks.includes("other")}
          label={t("What should we know?")}
          maxLength={MAX_CONDITION_NOTE_LENGTH}
          onChange={(text) => setText(props, text)}
          required
          value={draft.text}
        />
      )}
    </>
  );
}

function SupportNote(props: BodyProps) {
  const t = useExtracted();
  const noteId = useId();
  const helpId = useId();
  const [open, setOpen] = useState(props.draft.text !== "");

  if (!open) {
    return (
      <div className="flex">
        <Button
          edge="start"
          icon={<PlusIcon aria-hidden="true" />}
          onClick={() => setOpen(true)}
          type="button"
          variant="ghost"
        >
          {t("Something else that helps")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={noteId}>{t("What helps you, in your words (optional)")}</Label>
      <Textarea
        aria-describedby={helpId}
        autoFocus
        className="md:text-reading text-base"
        id={noteId}
        maxLength={MAX_MEMORY_STATEMENT_LENGTH}
        onChange={(event) => setText(props, event.target.value)}
        placeholder={t("E.g., I understand diagrams better than text")}
        value={props.draft.text}
      />
      <p className="text-muted-foreground text-sm" id={helpId}>
        {t("We'll remember this. You can delete it anytime in Settings.")}
      </p>
    </div>
  );
}

export function SupportBody(
  props: BodyProps & { label: string; prechecked: boolean },
) {
  const t = useExtracted();

  return (
    <>
      {props.prechecked && (
        <p className="text-muted-foreground -mt-2 text-sm text-pretty">
          {t("We checked what often helps with what you picked. Change anything you like.")}
        </p>
      )}

      <RowsBody {...props} />

      {props.memoryEnabled && <SupportNote {...props} />}
    </>
  );
}
