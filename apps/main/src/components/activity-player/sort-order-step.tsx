"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { shuffle } from "@zoonk/utils/shuffle";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

function getItemResultState(
  item: string,
  position: number,
  correctItems: string[],
): "correct" | "incorrect" {
  return correctItems[position] === item ? "correct" : "incorrect";
}

function getExpectedItem(position: number, correctItems: string[]): string | undefined {
  return correctItems[position];
}

function ItemButton({
  correctItems,
  item,
  nextPosition,
  onClick,
  position,
  resultState,
}: {
  correctItems?: string[];
  item: string;
  nextPosition: number;
  onClick: () => void;
  position: number | null;
  resultState?: "correct" | "incorrect";
}) {
  const t = useExtracted();
  const hasResult = resultState !== undefined;
  const isSelected = position !== null;

  const ariaLabel = (() => {
    if (hasResult && position !== null) {
      const result = resultState === "correct" ? t("Correct") : t("Incorrect");
      return t("Position {position}: {item}. {result}.", {
        item,
        position: String(position + 1),
        result,
      });
    }

    if (isSelected) {
      return t("Position {position}: {item}. Tap to remove.", {
        item,
        position: String(position + 1),
      });
    }

    return t("{item}. Tap to select as position {nextPosition}.", {
      item,
      nextPosition: String(nextPosition),
    });
  })();

  const expectedItem =
    resultState === "incorrect" && position !== null && correctItems
      ? getExpectedItem(position, correctItems)
      : undefined;

  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-150 sm:px-4 sm:py-2.5",
        hasResult && "pointer-events-none",
        !hasResult &&
          !isSelected &&
          "border-border/50 hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 border-dashed outline-none focus-visible:ring-[3px]",
        !hasResult && isSelected && "border-border",
        resultState === "correct" && "border-l-success border-l-2",
        resultState === "incorrect" && "border-l-destructive border-l-2",
      )}
      disabled={hasResult}
      onClick={onClick}
      type="button"
    >
      <Kbd
        className={cn(
          isSelected && "bg-primary text-primary-foreground",
          resultState === "correct" && "bg-success text-white",
          resultState === "incorrect" && "bg-destructive text-white",
        )}
      >
        {isSelected ? String(position + 1) : "\u00A0"}
      </Kbd>

      <div className="flex flex-col">
        <span className="text-base">{item}</span>

        {expectedItem ? (
          <span className="text-muted-foreground text-xs">
            {t('Expected: "{expectedItem}"', { expectedItem })}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function SortItemList({
  correctItems,
  items,
  onToggle,
  selections,
}: {
  correctItems?: string[];
  items: string[];
  onToggle: (item: string) => void;
  selections: string[];
}) {
  const t = useExtracted();
  const nextPosition = selections.length + 1;

  return (
    <div aria-label={t("Sort items")} className="flex flex-col gap-2" role="list">
      {items.map((item, index) => {
        const position = selections.indexOf(item);
        const isSelected = position !== -1;
        const resultState =
          correctItems && isSelected ? getItemResultState(item, position, correctItems) : undefined;

        return (
          <ItemButton
            correctItems={correctItems}
            item={item}
            key={`${item}-${index}`}
            nextPosition={nextPosition}
            onClick={() => onToggle(item)}
            position={isSelected ? position : null}
            resultState={resultState}
          />
        );
      })}
    </div>
  );
}

function InlineFeedback({
  content,
  result,
}: {
  content: { feedback: string | null };
  result: StepResult;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const isCorrect = result.result.isCorrect;
  const feedback = content.feedback ? replaceName(content.feedback) : null;

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite" className="sr-only" role="status">
        {isCorrect ? t("Correct") : t("Incorrect")}
      </div>

      {feedback ? <p className="text-muted-foreground text-sm">{feedback}</p> : null}
    </div>
  );
}

export function SortOrderStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const content = useMemo(() => parseStepContent("sortOrder", step.content), [step.content]);
  const replaceName = useReplaceName();

  const shuffledItems = useMemo(() => shuffle(content.items), [content.items]);

  const [selections, setSelections] = useState<string[]>(() => {
    if (result?.answer?.kind === "sortOrder") {
      return result.answer.userOrder;
    }

    return [];
  });

  const handleToggle = useCallback(
    (item: string) => {
      const index = selections.indexOf(item);

      if (index !== -1) {
        const next = selections.filter((_, idx) => idx !== index);
        setSelections(next);

        if (selectedAnswer) {
          onSelectAnswer(step.id, null);
        }

        return;
      }

      const next = [...selections, item];
      setSelections(next);

      if (next.length === content.items.length) {
        onSelectAnswer(step.id, { kind: "sortOrder", userOrder: next });
      }
    },
    [content.items.length, onSelectAnswer, selectedAnswer, selections, step.id],
  );

  const hasResult = result !== undefined;

  return (
    <InteractiveStepLayout>
      {content.question ? <QuestionText>{replaceName(content.question)}</QuestionText> : null}

      <p className="text-muted-foreground text-sm">{t("Tap items in the correct order")}</p>

      <SortItemList
        correctItems={hasResult ? content.items : undefined}
        items={shuffledItems}
        onToggle={handleToggle}
        selections={selections}
      />

      {result ? <InlineFeedback content={content} result={result} /> : null}
    </InteractiveStepLayout>
  );
}
