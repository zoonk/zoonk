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
import { type BodyProps, setText, useExclusiveLabels, usePicker } from "./profile-body-parts";
import { type ProfileExclusive } from "./profile-draft";

function changedRow(previous: readonly string[], next: readonly string[]): string | undefined {
  return next.find((id) => !previous.includes(id)) ?? previous.find((id) => !next.includes(id));
}

const NO_EXCLUSIVES: ProfileExclusive[] = [];

function RowsBody({
  exclusives = NO_EXCLUSIVES,
  ...props
}: BodyProps & { exclusives?: ProfileExclusive[]; label: string }) {
  const { draft, question } = props;
  const exclusiveLabels = useExclusiveLabels();
  const value = draft.exclusive ? [draft.exclusive] : draft.picks;
  const picker = usePicker(props);

  return (
    <CheckList
      choices={[
        ...question.options.map((option) => ({
          description: option.description ?? undefined,
          label: option.label,
          value: option.id,
        })),
        ...exclusives.map((exclusive) => ({ label: exclusiveLabels[exclusive], value: exclusive })),
      ]}
      label={props.label}
      onChange={(next) => {
        const changed = changedRow(value, next);
        const exclusive = exclusives.find((id) => id === changed);

        if (exclusive) {
          picker.exclusive(exclusive);
        } else if (changed) {
          picker.toggle(changed);
        }
      }}
      value={value}
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
          className="-ml-2.5"
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
        className="text-base md:text-[0.9375rem]"
        id={noteId}
        maxLength={MAX_MEMORY_STATEMENT_LENGTH}
        onChange={(event) => setText(props, event.target.value)}
        placeholder={t("E.g., I understand diagrams better than text")}
        value={props.draft.text}
      />
      <p className="text-muted-foreground text-sm" id={helpId}>
        {t("We'll remember this for your buddy. You can delete it in Memory.")}
      </p>
    </div>
  );
}

export function SupportBody(props: BodyProps & { label: string; prechecked: boolean }) {
  const t = useExtracted();

  return (
    <>
      {props.prechecked && (
        <p className="text-muted-foreground -mt-2 text-sm text-pretty">
          {t("We checked what often helps with what you picked. Change anything you like.")}
        </p>
      )}

      <RowsBody {...props} exclusives={["nothingInParticular"]} />

      {props.memoryEnabled && <SupportNote {...props} />}
    </>
  );
}
