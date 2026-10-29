"use client";

import { MAX_SESSION_TYPED_ANSWER_LENGTH } from "@zoonk/core/sessions/answer-limits";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";

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
          onSubmit(text.trim());
        }
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {t("Your answer")}
      </label>

      <InputGroup
        className="bg-background data-[result=correct]:border-success data-[result=wrong]:border-destructive h-14 rounded-lg"
        data-result={result ?? undefined}
      >
        <InputGroupInput
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          autoFocus
          className="text-lg disabled:opacity-100 md:text-lg"
          disabled={locked}
          enterKeyHint="done"
          id={inputId}
          maxLength={MAX_SESSION_TYPED_ANSWER_LENGTH}
          onChange={(event) => {
            setText(event.target.value);
            onChange?.(event.target.value.trim());
          }}
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
