"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { formatLocalizedNumber, parseLocalizedNumber } from "@zoonk/utils/localized-number";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useId, useState } from "react";

/** Where a math answer's unit sits: money before the number ("R$ 45"), the rest after it. */
type NumericUnit = { position: "prefix" | "suffix"; symbol: string };

/** Shown when a typed answer isn't a number, so the learner sees how their language writes one. */
const DECIMAL_EXAMPLE = 2.5;

function UnitAddon({ id, unit }: { id: string; unit: NumericUnit }) {
  return (
    <InputGroupAddon align={unit.position === "prefix" ? "inline-start" : "inline-end"}>
      <InputGroupText className="text-base" id={id}>
        {unit.symbol}
      </InputGroupText>
    </InputGroupAddon>
  );
}

/**
 * The answer field of a math problem. The learner types a number with a decimal comma or point
 * (either works in any language) next to its unit, and Enter submits it. Typing digits here never
 * picks an option. Once graded, it locks and marks the answer right or wrong. `children` go
 * inside the form, such as a submit button.
 */
export function NumericAnswerField({
  children,
  locked,
  onChange,
  onSubmit,
  result,
  unit,
}: {
  children?: React.ReactNode;
  locked: boolean;
  onChange?: (value: number | null) => void;
  onSubmit: (value: number) => void;
  result: "correct" | "wrong" | null;
  unit: NumericUnit | null;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const [inputId, unitId, hintId] = [useId(), useId(), useId()];
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const describedBy = [unit ? unitId : null, invalid ? hintId : null].filter(Boolean).join(" ");

  function submit() {
    const value = parseLocalizedNumber({ locale, text });

    if (value === null) {
      setInvalid(true);
      return;
    }

    onSubmit(value);
  }

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {t("Your answer")}
      </label>

      <InputGroup
        className="bg-background data-[result=correct]:border-success data-[result=wrong]:border-destructive h-14 rounded-2xl"
        data-result={result ?? undefined}
      >
        {unit?.position === "prefix" && <UnitAddon id={unitId} unit={unit} />}

        <InputGroupInput
          aria-describedby={describedBy || undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoFocus
          className="text-lg tabular-nums disabled:opacity-100 md:text-lg"
          disabled={locked}
          enterKeyHint="done"
          id={inputId}
          inputMode="decimal"
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
            onChange?.(parseLocalizedNumber({ locale, text: event.target.value }));
          }}
          spellCheck={false}
          value={text}
        />

        {unit?.position === "suffix" && <UnitAddon id={unitId} unit={unit} />}

        {result && (
          <InputGroupAddon align="inline-end">
            {result === "correct" ? (
              <CheckIcon aria-hidden="true" className="text-success" />
            ) : (
              <XIcon aria-hidden="true" className="text-destructive" />
            )}
          </InputGroupAddon>
        )}
      </InputGroup>

      {invalid && (
        <p className="text-destructive text-sm" id={hintId} role="alert">
          {t("Type a number, like {example}.", {
            example: formatLocalizedNumber({ locale, value: DECIMAL_EXAMPLE }),
          })}
        </p>
      )}

      {children}
    </form>
  );
}
