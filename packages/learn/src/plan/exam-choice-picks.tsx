"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { CheckList } from "../onboarding/choice-list";

type ExamChoicePicksProps = {
  choice: ExamChoiceView;
  onSave: (subjects: string[]) => void;
  pending: boolean;
  /** Outline where the page beside it keeps its own filled action. */
  saveVariant?: "default" | "outline";
};

function Picks({ choice, onSave, pending, saveVariant = "default" }: ExamChoicePicksProps) {
  const t = useExtracted();
  const [draft, setDraft] = useState<string[]>(choice.subjects);

  const isSaved =
    draft.length === choice.subjects.length &&
    draft.every((name) => choice.subjects.includes(name));

  return (
    <div className="flex flex-col gap-3">
      <CheckList
        choices={choice.options.map((option) => ({
          label: option.shortName ?? option.name,
          value: option.name,
        }))}
        label={choice.group}
        max={choice.take}
        numberKeys={false}
        onChange={setDraft}
        readOnly={pending}
        value={draft}
      />

      <Button
        busy={pending}
        className="self-start"
        disabled={draft.length === 0 || isSaved}
        focusableWhenDisabled
        onClick={() =>
          onSave(
            choice.options.flatMap((option) => (draft.includes(option.name) ? [option.name] : [])),
          )
        }
        size="sm"
        variant={saveVariant}
      >
        {t("Save")}
      </Button>
    </div>
  );
}

/** How many options a choice takes, where nothing above the picks says it already. */
export function ExamPickLimit({ take }: { take: number }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-sm">{t("Pick up to {take, number}.", { take })}</p>
  );
}

/**
 * The options of a choice whose candidates take several, saved together so the plan isn't rebuilt
 * on every tick; the draft starts again from the saved pick whenever it changes, as after an undo.
 */
export function ExamChoicePicks(props: ExamChoicePicksProps) {
  return <Picks key={props.choice.subjects.join("\n")} {...props} />;
}
