"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { keyedByPosition } from "../_utils/position-keys";
import { type FormulaResult } from "./pattern-results";

type Example = { inputs: readonly { name: string; value: number }[]; output: number };

function FormulaExampleRow({
  example,
  result,
}: {
  example: Example;
  result: FormulaResult | null;
}) {
  const t = useExtracted();
  const format = useFormatNumber();

  return (
    <tr className={cn("border-t", result && !result.passes && "bg-destructive/10")}>
      {example.inputs.map((input) => (
        <td className="px-3 py-2.5" key={input.name}>
          {format(input.value)}
        </td>
      ))}

      <td className="px-3 py-2.5 text-right font-medium">{format(example.output)}</td>

      <td className="px-3 py-2.5 text-right">
        <span className="inline-flex items-center justify-end gap-1.5">
          {result && result.value !== null && format(result.value)}
          {result?.passes === true && (
            <Check aria-label={t("matches")} className="text-success size-4" />
          )}
          {result && !result.passes && result.value !== null && (
            <X aria-label={t("doesn't match")} className="text-destructive size-4" />
          )}
        </span>
      </td>
    </tr>
  );
}

/**
 * The examples as a small spreadsheet: the input cells, the result each should give, and what
 * the learner's formula gives, marked when it matches.
 */
export function FormulaExamples({
  examples,
  results,
}: {
  examples: readonly Example[];
  results: readonly FormulaResult[] | null;
}) {
  const t = useExtracted();
  const names = examples[0]?.inputs.map((input) => input.name) ?? [];

  return (
    <div className="bg-background overflow-x-auto rounded-2xl border">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">{t("Examples for your formula")}</caption>

        <thead className="bg-muted/60 text-muted-foreground text-xs">
          <tr>
            {names.map((name) => (
              <th className="px-3 py-2 text-left font-mono font-medium" key={name} scope="col">
                {name}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium" scope="col">
              {t("Should give")}
            </th>
            <th className="px-3 py-2 text-right font-medium" scope="col">
              {t("Your result")}
            </th>
          </tr>
        </thead>

        <tbody>
          {keyedByPosition(examples, (example) => String(example.output)).map(
            ({ item, key }, position) => (
              <FormulaExampleRow example={item} key={key} result={results?.[position] ?? null} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
