"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type SelectImageStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { SELECT_IMAGE_PROPS } from "../image-config";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { useOptionKeyboard } from "../use-option-keyboard";
import { InlineFeedback } from "./inline-feedback";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

function getSelectedOptionId(selectedAnswer?: SelectedAnswer): string | null {
  if (selectedAnswer?.kind !== "selectImage") {
    return null;
  }

  return selectedAnswer.selectedOptionId;
}

function getImageOptionResultState(
  option: SelectImageStepContent["options"][number],
  selectedOptionId: string,
): "correct" | "incorrect" | null {
  if (option.isCorrect) {
    return "correct";
  }

  if (option.id === selectedOptionId) {
    return "incorrect";
  }

  return null;
}

function ImageWithFallback({ alt, url }: { alt: string; url?: string }) {
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
      loading="eager"
      onError={() => setHasError(true)}
      src={url}
      {...SELECT_IMAGE_PROPS}
    />
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
  resultState: "correct" | "incorrect" | null;
  url?: string;
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
        resultState === "correct" && "border-success/60 opacity-80",
        resultState === "incorrect" && "border-destructive/60 opacity-80",
      )}
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <ImageWithFallback alt={prompt} url={url} />
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
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const content = parseStepContent("selectImage", step.content);
  const selectedOptionId = getSelectedOptionId(selectedAnswer);
  const hasResult = Boolean(result);

  const handleSelect = (index: number) => {
    if (result) {
      return;
    }

    const option = content.options[index];

    if (!option) {
      return;
    }

    onSelectAnswer(step.id, { kind: "selectImage", selectedOptionId: option.id });
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
            hasResult && selectedOptionId
              ? getImageOptionResultState(option, selectedOptionId)
              : null;
          const isDimmed = hasResult && !resultState;
          const isSelected = selectedOptionId === option.id;

          return (
            <ImageOptionCard
              disabled={hasResult}
              isDimmed={isDimmed}
              isSelected={isSelected}
              key={option.id}
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
