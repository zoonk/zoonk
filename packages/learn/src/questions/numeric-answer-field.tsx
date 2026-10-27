"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { formatLocalizedNumber } from "@zoonk/utils/localized-number";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useId, useState } from "react";
import { type NumericEntry, parseEntryAnswer } from "./_utils/numeric-entry";

/** Where a math answer's unit sits: money before the number ("R$ 45"), the rest after it. */
type NumericUnit = { position: "prefix" | "suffix"; symbol: string };

/** Shown when a typed answer isn't a number, so the learner sees how their language writes one. */
const DECIMAL_EXAMPLE = 2.5;

/** The answer box's rule under the field, when it takes less than any number. */
function EntryRule({ entry, id }: { entry: NumericEntry; id: string }) {
  const t = useExtracted();

  const rule = {
    decimals: t(
      "{places, plural, one {Round to # decimal place.} other {Round to # decimal places.}}",
      { places: entry.places ?? 0 },
    ),
    fraction: t("A fraction, like 2/3, or a decimal."),
    integer: t("A whole number."),
    number: null,
  }[entry.kind];

  return rule ? (
    <p className="text-muted-foreground text-sm" id={id}>
      {rule}
    </p>
  ) : null;
}

/** How to type a number this box takes, once the learner typed one it doesn't. */
function InvalidHint({ entry, id }: { entry: NumericEntry | null; id: string }) {
  const t = useExtracted();
  const locale = useLocale();

  const example = formatLocalizedNumber({ locale, value: DECIMAL_EXAMPLE });

  const hints = {
    decimals: t("Type a number, like {example}.", { example }),
    fraction: t("Type a fraction, like 2/3, or a number, like {example}.", { example }),
    integer: t("Type a whole number, like 12."),
    number: t("Type a number, like {example}.", { example }),
  };

  return (
    <p className="text-destructive-text text-sm" id={id} role="alert">
      {hints[entry?.kind ?? "number"]}
    </p>
  );
}

/** The field's description: its unit, its rule and the hint, whichever show. */
function describeField(ids: Record<"hint" | "rule" | "unit", string | false>): string | undefined {
  return [ids.unit, ids.rule, ids.hint].filter(Boolean).join(" ") || undefined;
}

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
 * (either works in any language) next to its unit, and Enter submits it. A box that takes less
 * than any number (`entry`: a whole number, n decimal places, a fraction) says so under the field,
 * and a fraction box takes "2/3" as its value. Typing digits here never picks an option. Once
 * graded, it locks and marks the answer right or wrong. `children` go inside the form, such as a
 * submit button.
 */
export function NumericAnswerField({
  children,
  defaultText = "",
  entry = null,
  locked,
  onChange,
  onSubmit,
  result,
  unit,
}: {
  children?: React.ReactNode;
  /** The answer typed before, shown when the field opens again (a mock's draft). */
  defaultText?: string;
  entry?: NumericEntry | null;
  locked: boolean;
  onChange?: (value: number | null) => void;
  onSubmit: (value: number) => void;
  result: "correct" | "wrong" | null;
  unit: NumericUnit | null;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const [inputId, unitId, hintId, ruleId] = [useId(), useId(), useId(), useId()];
  const [text, setText] = useState(defaultText);
  const [invalid, setInvalid] = useState(false);
  const hasRule = entry !== null && entry.kind !== "number";

  const showsRule = hasRule && !invalid;

  const describedBy = describeField({
    hint: invalid && hintId,
    rule: showsRule && ruleId,
    unit: unit !== null && unitId,
  });

  function submit() {
    const value = parseEntryAnswer({ entry, locale, text });

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
        className="bg-background data-[result=correct]:border-success data-[result=wrong]:border-destructive h-14 rounded-lg"
        data-result={result ?? undefined}
      >
        {unit?.position === "prefix" && <UnitAddon id={unitId} unit={unit} />}

        <InputGroupInput
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoFocus
          className="text-lg tabular-nums disabled:opacity-100 md:text-lg"
          disabled={locked}
          enterKeyHint="done"
          id={inputId}
          // A phone's decimal keypad has no slash, so a fraction box opens the full keyboard.
          inputMode={entry?.kind === "fraction" ? "text" : "decimal"}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
            onChange?.(parseEntryAnswer({ entry, locale, text: event.target.value }));
          }}
          spellCheck={false}
          value={text}
        />

        {unit?.position === "suffix" && <UnitAddon id={unitId} unit={unit} />}

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

      {showsRule && <EntryRule entry={entry} id={ruleId} />}
      {invalid && <InvalidHint entry={entry} id={hintId} />}

      {children}
    </form>
  );
}
