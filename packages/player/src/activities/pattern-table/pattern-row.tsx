"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";
import { type ActivityRendererProps } from "../activity-renderer";
import { blankStem, splitForm } from "./pattern-cells";

type PatternRowData = ActivityRendererProps<"patternTable">["content"]["fields"]["rows"][number];

/** A form with its ending in color, the part the pattern is about. */
function Form({ form, stem }: { form: string; stem: string }) {
  const parts = splitForm(form, stem);

  return (
    <>
      {parts.stem}
      <b className="text-viz-accent font-semibold">{parts.ending}</b>
    </>
  );
}

/** A blank after the check: the learner's ending, and the right one when it differs. */
function CheckedBlank({
  chosen,
  expected,
  stem,
}: {
  chosen: string | null;
  expected: string | null;
  stem: string;
}) {
  const t = useExtracted();
  const isRight = chosen !== null && chosen === expected;

  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn(isRight ? "text-success" : "text-destructive line-through")}>
        {stem}
        <b className="font-semibold">{chosen ?? ""}</b>
      </span>

      {!isRight && expected && (
        <span className="text-success">
          <span className="sr-only">{`${t("Correct answer:")} `}</span>
          {stem}
          <b className="font-semibold">{expected}</b>
        </span>
      )}
    </span>
  );
}

/** A blank to fill: tap it to choose its ending below. */
function OpenBlank({
  chosen,
  isActive,
  label,
  onSelect,
  stem,
}: {
  chosen: string | null;
  isActive: boolean;
  label: string;
  onSelect: () => void;
  stem: string;
}) {
  const t = useExtracted();

  return (
    <button
      aria-label={t("{person}: {word}, choose the ending", {
        person: label,
        word: `${stem}${chosen ?? "…"}`,
      })}
      aria-pressed={isActive}
      className={cn(
        "-ml-2 flex h-11 min-w-24 items-center rounded-xl border-2 bg-transparent pl-2 text-left outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        isActive ? "border-viz-accent bg-background" : "border-transparent",
      )}
      onClick={onSelect}
      onKeyDown={keepArrowKeys}
      type="button"
    >
      {stem}
      {chosen ? (
        <b className="text-viz-accent font-semibold">{chosen}</b>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "ml-0.5 inline-block h-5 w-9 border-b-2",
            isActive
              ? "border-viz-accent bg-viz-accent-soft rounded-t"
              : "border-muted-foreground/50",
          )}
        />
      )}
    </button>
  );
}

/** One person of the pattern: its label, the model word's form and the new word's form. */
export function PatternRow({
  choices,
  chosen,
  expected,
  isActive,
  isChecked,
  modelStem,
  newStem,
  onSelect,
  row,
}: {
  choices: readonly string[];
  chosen: string | null;
  expected: string | null;
  isActive: boolean;
  isChecked: boolean;
  modelStem: string;
  newStem: string;
  onSelect: () => void;
  row: PatternRowData;
}) {
  const stem = blankStem(choices, row.answer);

  return (
    <tr>
      <th className="py-2 pr-2 text-left align-middle font-normal" scope="row">
        <span className="block font-medium">{row.label}</span>
        {row.labelMeaning && (
          <span className="text-muted-foreground block text-xs">{row.labelMeaning}</span>
        )}
      </th>

      <td className="px-2 py-2 align-middle">
        <Form form={row.model} stem={modelStem} />
      </td>

      <td className="px-2 py-2 align-middle">
        {!row.blank && <Form form={row.answer} stem={newStem} />}

        {row.blank && isChecked && <CheckedBlank chosen={chosen} expected={expected} stem={stem} />}

        {row.blank && !isChecked && (
          <OpenBlank
            chosen={chosen}
            isActive={isActive}
            label={row.label}
            onSelect={onSelect}
            stem={stem}
          />
        )}
      </td>
    </tr>
  );
}
