"use client";

import {
  MAX_ESSAY_CHARACTERS,
  type WritingPrompt,
} from "@zoonk/core/exams/essays/writing-contract";
import { Textarea } from "@zoonk/ui/components/textarea";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { ESSAY_FIELD_CLASS } from "../essay/essay-labels";
import { WritingLineCount } from "./writing-line-count";

/** A copy restored from before the field had its limit: it says what to cut instead of failing to save. */
function TooLong({ text }: { text: string }) {
  const t = useExtracted();
  const format = useFormatter();
  const over = text.length - MAX_ESSAY_CHARACTERS;

  if (over <= 0) {
    return null;
  }

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("This answer is {count} characters too long. Shorten it to save and grade it.", {
        count: format.number(over),
      })}
    </p>
  );
}

/**
 * The field fills the screen; the count of lines graders would read stays under it. It takes no
 * more than the server saves and grades, and no edits while `readOnly`.
 */
export function WritingEditor({
  label,
  onChange,
  readOnly = false,
  text,
  writing,
}: {
  label: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
  text: string;
  writing: WritingPrompt;
}) {
  const id = useId();

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" data-slot="writing-editor">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Textarea
        aria-describedby={`${id}-count`}
        className={cn(ESSAY_FIELD_CLASS, "field-sizing-fixed min-h-0 flex-1")}
        id={id}
        maxLength={MAX_ESSAY_CHARACTERS}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        value={text}
      />
      <WritingLineCount id={`${id}-count`} text={text} writing={writing} />
      <TooLong text={text} />
    </section>
  );
}
