"use client";

import { MAX_SESSION_TYPED_ANSWER_LENGTH } from "@zoonk/core/sessions/answer-limits";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ANSWER_GROUP_CLASS, putAwayOnScreenKeyboard } from "./answer-field";

export function TypedAnswerField({
  children,
  locked,
  onChange,
  onSubmit,
  result,
}: {
  children?: React.ReactNode;
  locked: boolean;
  onChange?: (text: string) => void;
  onSubmit: (text: string) => void;
  result: "correct" | "wrong" | null;
}) {
  const t = useExtracted();
  const inputId = useId();
  const [text, setText] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        if (text.trim() && !locked) {
          putAwayOnScreenKeyboard();
          onSubmit(text.trim());
        }
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {t("Your answer")}
      </label>

      <InputGroup className={ANSWER_GROUP_CLASS} data-result={result ?? undefined}>
        <InputGroupInput
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          autoFocus
          className="text-lg md:text-lg"
          enterKeyHint="done"
          id={inputId}
          maxLength={MAX_SESSION_TYPED_ANSWER_LENGTH}
          onChange={(event) => {
            setText(event.target.value);
            onChange?.(event.target.value.trim());
          }}
          readOnly={locked}
          spellCheck={false}
          value={text}
        />

        {result && (
          <InputGroupAddon align="inline-end">
            {result === "correct" ? (
              <CheckIcon aria-hidden="true" className="text-success-text" />
            ) : (
              <XIcon aria-hidden="true" className="text-destructive-text" />
            )}
          </InputGroupAddon>
        )}
      </InputGroup>

      {children}
    </form>
  );
}
