"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySelectGrid, ActivitySelectGridItem } from "../_components/activity-select-grid";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { commonStem, nextOpenBlank } from "./pattern-cells";
import { PatternRow } from "./pattern-row";

type PatternTableProps = ActivityRendererProps<"patternTable">;

function expectedEndings(props: PatternTableProps): Record<string, string> {
  const { expected } = props;

  return expectedInteraction(expected, "assignment")?.pairs ?? {};
}

function WordHeader({ meaning, word }: { meaning?: string; word: string }) {
  return (
    <th className="px-2 pb-2 text-left align-bottom font-normal" scope="col">
      <span className="block text-base font-semibold">{word}</span>
      {meaning && <span className="text-muted-foreground block text-xs">{meaning}</span>}
    </th>
  );
}

/**
 * A full pattern for a model word, then the same pattern for a new word with cells left blank:
 * pick a blank, then its ending. The answer is each blank's ending, which core computes from the
 * written forms. After the check, each blank shows the learner's ending and the right one.
 */
export function PatternTableActivity(props: PatternTableProps) {
  const t = useExtracted();
  const { answer, content, labelId, onAnswerChange, phase } = props;
  const { fields } = content;
  const isChecked = phase === "checked";
  const blanks = fields.rows.flatMap((row, index) => (row.blank ? [index] : []));

  const [filled, setFilled] = useState<Record<string, string>>(() =>
    answer?.kind === "assignment" ? answer.pairs : {},
  );

  const [active, setActive] = useState<number | null>(() =>
    nextOpenBlank({ blanks, current: null, filled }),
  );

  const activeRow = active === null ? null : fields.rows[active];
  const modelStem = commonStem(fields.rows.map((row) => row.model));
  const newStem = commonStem(fields.rows.map((row) => row.answer));
  const expected = expectedEndings(props);

  function choose(ending: string) {
    if (active === null) {
      return;
    }

    const next = { ...filled, [String(active)]: ending };
    const isComplete = blanks.every((row) => next[String(row)] !== undefined);

    setFilled(next);
    setActive(nextOpenBlank({ blanks, current: active, filled: next }) ?? active);
    onAnswerChange(isComplete ? { kind: "assignment", pairs: next } : null);
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <div className="bg-background overflow-x-auto rounded-2xl px-2 py-3">
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-border border-b">
              <td />
              <WordHeader meaning={fields.modelMeaning} word={fields.modelWord} />
              <WordHeader meaning={fields.newMeaning} word={fields.newWord} />
            </tr>
          </thead>

          <tbody className="divide-border divide-y">
            {fields.rows.map((row, index) => (
              <PatternRow
                choices={fields.choices}
                chosen={filled[String(index)] ?? null}
                expected={isChecked ? (expected[String(index)] ?? null) : null}
                isActive={!isChecked && active === index}
                isChecked={isChecked}
                key={`${row.label}-${row.model}`}
                modelStem={modelStem}
                newStem={newStem}
                onSelect={() => setActive(index)}
                row={row}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!isChecked && activeRow && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" id={`${labelId}-endings`}>
            {t("Which ending does {person} take?", { person: activeRow.label })}
          </p>

          <ActivitySelectGrid
            className={cn(fields.choices.length > 3 ? "grid-cols-4" : "grid-cols-3")}
            label={t("Endings for {person}", { person: activeRow.label })}
          >
            {fields.choices.map((choice) => (
              <ActivitySelectGridItem
                className="text-base"
                isSelected={filled[String(active)] === choice}
                key={choice}
                onToggle={() => choose(choice)}
              >
                {`-${choice}`}
              </ActivitySelectGridItem>
            ))}
          </ActivitySelectGrid>
        </div>
      )}

      <ActivityTextAlternative>
        {t(
          "A table of {model} and {word}. {count, plural, one {# cell is} other {# cells are}} left for you to complete.",
          { count: blanks.length, model: fields.modelWord, word: fields.newWord },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
