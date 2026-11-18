"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { ignoreHeldEnter } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { formatLocalizedNumber } from "@zoonk/utils/localized-number";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { useAppLocale } from "../_utils/locale";
import { type NumericEntry, getNumericEntryRule, parseEntryAnswer } from "./_utils/numeric-entry";
import { ANSWER_GROUP_CLASS, focusAnswerOnPointer, putAwayOnScreenKeyboard } from "./answer-field";

type NumericUnit = { position: "prefix" | "suffix"; symbol: string };

const DECIMAL_EXAMPLE = 2.5;

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
    roundToWhole: t("Round to the nearest whole number."),
  }[getNumericEntryRule(entry)];

  return rule ? (
    <p className="text-muted-foreground text-sm" id={id}>
      {rule}
    </p>
  ) : null;
}

function InvalidHint({ entry, id }: { entry: NumericEntry | null; id: string }) {
  const t = useExtracted();
  const locale = useAppLocale();

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

function EntryNote({
  entry,
  hintId,
  invalid,
  ruleId,
}: {
  entry: NumericEntry | null;
  hintId: string;
  invalid: boolean;
  ruleId: string;
}) {
  if (invalid) {
    return <InvalidHint entry={entry} id={hintId} />;
  }

  return entry && <EntryRule entry={entry} id={ruleId} />;
}

function describeField(ids: Record<"hint" | "rule" | "unit", string | false>): string | undefined {
  return [ids.unit, ids.rule, ids.hint].filter(Boolean).join(" ") || undefined;
}

function UnitAddon({
  id,
  hasValue = true,
  nearValue = false,
  position,
  unit,
}: {
  id: string;
  hasValue?: boolean;
  nearValue?: boolean;
  position: NumericUnit["position"];
  unit: NumericUnit | null;
}) {
  if (unit?.position !== position) {
    return null;
  }

  return (
    <InputGroupAddon
      align={unit.position === "prefix" ? "inline-start" : "inline-end"}
      className={cn(
        nearValue && "min-w-fit flex-1 justify-start",
        nearValue && !hasValue && "sr-only",
      )}
    >
      <InputGroupText className="text-base" id={id}>
        {unit.symbol}
      </InputGroupText>
    </InputGroupAddon>
  );
}

function useNumericText({
  defaultText,
  entry,
  locale,
  locked,
  maximumFractionDigits,
  value,
}: {
  defaultText: string;
  entry: NumericEntry | null;
  locale: string;
  locked: boolean;
  maximumFractionDigits?: number;
  value?: number | null;
}) {
  function formattedValue() {
    if (value === undefined) {
      return defaultText;
    }

    return value === null ? "" : formatLocalizedNumber({ locale, maximumFractionDigits, value });
  }

  const written = formattedValue();
  const [text, setText] = useState(written);
  const [previousValue, setPreviousValue] = useState(value);

  if (value !== previousValue) {
    setPreviousValue(value);

    if (value !== undefined && parseEntryAnswer({ entry, locale, text }) !== value) {
      setText(written);
    }
  }

  return [locked && value !== undefined ? written : text, setText] as const;
}

export function NumericAnswerField({
  defaultText = "",
  entry = null,
  locked,
  labelledBy,
  maximumFractionDigits,
  onChange,
  onSubmit,
  result,
  unit,
  value,
}: {
  defaultText?: string;
  entry?: NumericEntry | null;
  locked: boolean;
  labelledBy?: string;
  maximumFractionDigits?: number;
  value?: number | null;
  onChange?: (value: number | null) => void;
  onSubmit: (value: number) => void;
  result: "correct" | "wrong" | null;
  unit: NumericUnit | null;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const [inputId, unitId, hintId, ruleId] = [useId(), useId(), useId(), useId()];

  const [text, setText] = useNumericText({
    defaultText,
    entry,
    locale,
    locked,
    maximumFractionDigits,
    value,
  });

  const [invalid, setInvalid] = useState(false);
  const hasRule = entry !== null && entry.kind !== "number";

  const showsDegree = unit?.position === "suffix" && unit.symbol === "°";
  const showsRule = hasRule && !invalid;

  const describedBy = describeField({
    hint: invalid && hintId,
    rule: showsRule && ruleId,
    unit: unit !== null && unitId,
  });

  function submit() {
    if (locked) {
      return;
    }

    const parsed = parseEntryAnswer({ entry, locale, text });

    if (parsed === null) {
      setInvalid(true);
      return;
    }

    putAwayOnScreenKeyboard();
    onSubmit(parsed);
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

      {/* A typing error takes the rule's line; with no rule it goes under the field, so the field stays put. */}
      {hasRule && <EntryNote entry={entry} hintId={hintId} invalid={invalid} ruleId={ruleId} />}

      <InputGroup
        className={cn(
          ANSWER_GROUP_CLASS,
          "data-result:has-[[data-slot=input-group-control]:focus-visible]:ring-0!",
        )}
        data-result={result ?? undefined}
      >
        <UnitAddon id={unitId} position="prefix" unit={unit} />

        <InputGroupInput
          aria-describedby={describedBy}
          aria-labelledby={labelledBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          className={cn(
            "text-lg tabular-nums md:text-lg",
            showsDegree && text && "field-sizing-content w-auto min-w-0 flex-[0_1_auto] pr-0!",
          )}
          enterKeyHint="done"
          id={inputId}
          // A phone's decimal keypad has no slash, so a fraction box opens the full keyboard.
          inputMode={entry?.kind === "fraction" ? "text" : "decimal"}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
            onChange?.(parseEntryAnswer({ entry, locale, text: event.target.value }));
          }}
          onKeyDown={ignoreHeldEnter}
          readOnly={locked}
          ref={focusAnswerOnPointer}
          spellCheck={false}
          value={text}
        />

        <UnitAddon
          hasValue={Boolean(text)}
          id={unitId}
          nearValue={showsDegree}
          position="suffix"
          unit={unit}
        />

        <InputGroupAddon
          align="inline-end"
          className={result === null ? "invisible" : undefined}
          aria-hidden={result === null}
        >
          {result === "wrong" ? (
            <XIcon aria-hidden="true" className="text-destructive-text" />
          ) : (
            <CheckIcon aria-hidden="true" className="text-success-text" />
          )}
        </InputGroupAddon>
      </InputGroup>

      {!hasRule && <EntryNote entry={entry} hintId={hintId} invalid={invalid} ruleId={ruleId} />}
    </form>
  );
}
