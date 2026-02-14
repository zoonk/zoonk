"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { shuffle } from "@zoonk/utils/shuffle";
import { CheckIcon, XIcon } from "lucide-react";
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

function ItemButton({
  item,
  nextPosition,
  onClick,
  position,
  resultState,
}: {
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
    if (hasResult) {
      const result = resultState === "correct" ? t("Correct") : t("Incorrect");
      return t("{item}. {result}.", { item, result });
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

  const kbdContent = (() => {
    if (resultState === "correct") {
      return <CheckIcon aria-hidden="true" className="size-3" />;
    }

    if (resultState === "incorrect") {
      return <XIcon aria-hidden="true" className="size-3" />;
    }

    if (isSelected) {
      return String(position + 1);
    }

    return "\u00A0";
  })();

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
          isSelected && !hasResult && "bg-primary text-primary-foreground",
          resultState === "correct" && "bg-success text-white",
          resultState === "incorrect" && "bg-destructive text-white",
        )}
      >
        {kbdContent}
      </Kbd>

      <span className="text-base">{item}</span>
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
  const displayItems = correctItems ?? items;

  return (
    <div aria-label={t("Sort items")} className="flex flex-col gap-2" role="list">
      {displayItems.map((item, index) => {
        const resultState = correctItems ? getItemResultState(item, index, selections) : undefined;
        const position = correctItems ? index : selections.indexOf(item);
        const isSelected = position !== -1;

        return (
          <ItemButton
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
