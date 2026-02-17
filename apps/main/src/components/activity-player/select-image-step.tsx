"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { type SelectedAnswer } from "./player-reducer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useOptionKeyboard } from "./use-option-keyboard";

function getSelectedIndex(selectedAnswer: SelectedAnswer | undefined): number | null {
  if (selectedAnswer?.kind !== "selectImage") {
    return null;
  }

  return selectedAnswer.selectedIndex;
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

function ImageOptionCard({
  isSelected,
  onSelect,
  prompt,
  url,
}: {
  isSelected: boolean;
  onSelect: () => void;
  prompt: string;
  url: string | undefined;
}) {
  return (
    <button
      aria-checked={isSelected}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 overflow-hidden rounded-xl border transition-colors duration-150 outline-none focus-visible:ring-[3px]",
        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
      )}
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
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const content = parseStepContent("selectImage", step.content);
  const selectedIndex = getSelectedIndex(selectedAnswer);

  const handleSelect = (index: number) => {
    onSelectAnswer(step.id, { kind: "selectImage", selectedIndex: index });
  };

  useOptionKeyboard({
    enabled: selectedAnswer === undefined || selectedAnswer.kind === "selectImage",
    onSelect: handleSelect,
    optionCount: content.options.length,
  });

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{content.question}</QuestionText>}

      <div aria-label={t("Image options")} className="grid grid-cols-2 gap-3" role="radiogroup">
        {content.options.map((option, index) => (
          <ImageOptionCard
            isSelected={selectedIndex === index}
            key={option.prompt}
            onSelect={() => handleSelect(index)}
            prompt={option.prompt}
            url={option.url}
          />
        ))}
      </div>
    </InteractiveStepLayout>
  );
}
