"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type SelectImageStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { SELECT_IMAGE_PROPS } from "../image-config";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { useOptionKeyboard } from "../use-option-keyboard";
import { InlineFeedback } from "./inline-feedback";
import { QuestionText } from "./question-text";
import { ResultKbd } from "./result-kbd";
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

/**
 * Result badges need the same decision in every option without nesting that
 * branching inside the render loop.
 */
function getImageOptionStatusLabel({
  correctLabel,
  incorrectLabel,
  resultState,
}: {
  correctLabel: string;
  incorrectLabel: string;
  resultState: "correct" | "incorrect" | null;
}): string | null {
  if (resultState === "correct") {
    return correctLabel;
  }

  if (resultState === "incorrect") {
    return incorrectLabel;
  }

  return null;
}

/**
 * Select-image quizzes usually compare two to four square images. A two-column
 * mobile grid is easy to scan by touch, but larger screens should keep every
 * option in one row so learners can compare the visual evidence without
 * scrolling between rows.
 */
function getImageOptionLayout(optionCount: number): {
  frameClassName: string;
  gridClassName: string;
} {
  if (optionCount <= 1) {
    return { frameClassName: "md:max-w-sm", gridClassName: "md:grid-cols-1" };
  }

  if (optionCount === 2) {
    return { frameClassName: "md:max-w-2xl", gridClassName: "md:grid-cols-2" };
  }

  if (optionCount === 3) {
    return { frameClassName: "md:max-w-3xl", gridClassName: "md:grid-cols-3" };
  }

  return { frameClassName: "md:max-w-4xl", gridClassName: "md:grid-cols-4" };
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
  index,
  isDimmed,
  isSelected,
  onSelect,
  prompt,
  resultState,
  statusLabel,
  url,
}: {
  disabled: boolean;
  index: number;
  isDimmed: boolean;
  isSelected: boolean;
  onSelect: () => void;
  prompt: string;
  resultState: "correct" | "incorrect" | null;
  statusLabel: string | null;
  url?: string;
}) {
  const StatusIcon = resultState === "correct" ? CircleCheck : CircleX;

  return (
    <button
      aria-label={prompt}
      aria-checked={isSelected}
      aria-keyshortcuts={String(index + 1)}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 relative overflow-hidden rounded-xl border-2 transition-all duration-150 outline-none focus-visible:ring-[3px]",
        disabled && "pointer-events-none",
        isDimmed && "opacity-35 grayscale",
        !resultState && isSelected && "border-info bg-info/10 ring-info ring-4",
        !resultState && !isSelected && "border-border hover:bg-accent",
        resultState === "correct" && "border-success bg-success/5 ring-success ring-4",
        resultState === "incorrect" &&
          "border-destructive bg-destructive/5 ring-destructive ring-4",
      )}
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <ImageWithFallback alt={prompt} url={url} />

      <span className="absolute top-2 left-2 hidden lg:pointer-fine:block">
        <ResultKbd isSelected={isSelected} resultState={resultState ?? undefined}>
          {index + 1}
        </ResultKbd>
      </span>

      {!resultState && isSelected && (
        <span className="bg-info absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-white">
          <CircleCheck aria-hidden="true" className="size-4" />
        </span>
      )}

      {resultState && statusLabel && (
        <span
          className={cn(
            "absolute top-2 right-2 flex items-center gap-1 rounded-full border bg-white/95 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm",
            resultState === "correct" && "border-success/20 text-success",
            resultState === "incorrect" && "border-destructive/20 text-destructive",
          )}
        >
          <StatusIcon aria-hidden="true" className="size-3.5" />
          {statusLabel}
        </span>
      )}
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
  const correctAnswerLabel = t("Correct answer");
  const yourAnswerLabel = t("Your answer");
  const imageOptionLayout = getImageOptionLayout(content.options.length);

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
    <InteractiveStepLayout className={imageOptionLayout.frameClassName}>
      {content.question && <QuestionText>{content.question}</QuestionText>}

      <div
        aria-label={t("Image options")}
        className={cn("grid grid-cols-2 gap-3", imageOptionLayout.gridClassName)}
        role="radiogroup"
      >
        {content.options.map((option, index) => {
          const resultState =
            hasResult && selectedOptionId
              ? getImageOptionResultState(option, selectedOptionId)
              : null;

          const isDimmed = hasResult && !resultState;
          const isSelected = selectedOptionId === option.id;

          const statusLabel = getImageOptionStatusLabel({
            correctLabel: correctAnswerLabel,
            incorrectLabel: yourAnswerLabel,
            resultState,
          });

          return (
            <ImageOptionCard
              disabled={hasResult}
              index={index}
              isDimmed={isDimmed}
              isSelected={isSelected}
              key={option.id}
              onSelect={() => handleSelect(index)}
              prompt={option.prompt}
              resultState={resultState}
              statusLabel={statusLabel}
              url={option.url}
            />
          );
        })}
      </div>

      {result && <InlineFeedback result={result} />}
    </InteractiveStepLayout>
  );
}
