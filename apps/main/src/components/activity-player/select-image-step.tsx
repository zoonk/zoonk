"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { type SelectImageStepContent, parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { InlineFeedback } from "./inline-feedback";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useOptionKeyboard } from "./use-option-keyboard";

function getSelectedIndex(selectedAnswer: SelectedAnswer | undefined): number | null {
  if (selectedAnswer?.kind !== "selectImage") {
    return null;
  }

  return selectedAnswer.selectedIndex;
}

function getImageOptionResultState(
  index: number,
  content: SelectImageStepContent,
  selectedIndex: number,
): "correct" | "incorrect" | undefined {
  if (content.options[index]?.isCorrect) {
    return "correct";
  }

  if (index === selectedIndex) {
    return "incorrect";
  }

  return undefined;
}

function ImageWithFallback({ alt, url }: { alt: string; url: string | undefined }) {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div className="bg-muted flex aspect-square items-center justify-center p-4">
        <span className="text-muted-foreground text-center text-sm font-medium">{alt}</span>
      </div>
    );
  }

  return (
    <Image
      alt={alt}
      className="aspect-square object-cover"
      height={336}
      onError={() => setHasError(true)}
      sizes="(max-width: 672px) 50vw, 336px"
      src={url}
      width={336}
    />
  );
}

function ResultBadge({ state }: { state: "correct" | "incorrect" }) {
  return (
    <div
      className={cn(
        "absolute top-2 right-2 rounded-full p-0.5",
        state === "correct" ? "bg-success text-success-foreground" : "bg-destructive text-white",
      )}
    >
      {state === "correct" ? (
        <CircleCheck aria-hidden="true" className="size-4" />
      ) : (
        <CircleX aria-hidden="true" className="size-4" />
      )}
    </div>
  );
}

function ImageOptionCard({
  disabled,
  isDimmed,
  isSelected,
  onSelect,
  prompt,
  resultState,
  url,
}: {
  disabled: boolean;
  isDimmed: boolean;
  isSelected: boolean;
  onSelect: () => void;
  prompt: string;
  resultState?: "correct" | "incorrect";
  url: string | undefined;
}) {
  return (
    <button
      aria-checked={isSelected}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 relative overflow-hidden rounded-xl border-2 transition-colors duration-150 outline-none focus-visible:ring-[3px]",
        disabled && "pointer-events-none",
        isDimmed && "opacity-50",
        !resultState && isSelected && "border-primary bg-primary/5",
        !resultState && !isSelected && "border-border hover:bg-accent",
        resultState === "correct" && "border-success",
        resultState === "incorrect" && "border-destructive",
      )}
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <ImageWithFallback alt={prompt} url={url} />

      {resultState && <ResultBadge state={resultState} />}
    </button>
  );
}

export function SelectImageStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const content = parseStepContent("selectImage", step.content);
  const selectedIndex = getSelectedIndex(selectedAnswer);
  const hasResult = Boolean(result);

  const handleSelect = (index: number) => {
    if (result) {
      return;
    }

    onSelectAnswer(step.id, { kind: "selectImage", selectedIndex: index });
  };

  useOptionKeyboard({
    enabled: !result && (selectedAnswer === undefined || selectedAnswer.kind === "selectImage"),
    onSelect: handleSelect,
    optionCount: content.options.length,
  });

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{content.question}</QuestionText>}

      <div aria-label={t("Image options")} className="grid grid-cols-2 gap-3" role="radiogroup">
        {content.options.map((option, index) => {
          const resultState =
            hasResult && selectedIndex !== null
              ? getImageOptionResultState(index, content, selectedIndex)
              : undefined;
          const isDimmed = hasResult && !resultState;

          return (
            <ImageOptionCard
              disabled={hasResult}
              isDimmed={isDimmed}
              isSelected={selectedIndex === index}
              key={option.prompt}
              onSelect={() => handleSelect(index)}
              prompt={option.prompt}
              resultState={resultState}
              url={option.url}
            />
          );
        })}
      </div>

      {result && <InlineFeedback result={result} />}
    </InteractiveStepLayout>
  );
}
