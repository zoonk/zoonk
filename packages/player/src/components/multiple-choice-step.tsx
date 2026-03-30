"use client";

import {
  type CoreMultipleChoiceContent,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { useExtracted } from "next-intl";
import { type SelectedAnswer } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { useReplaceName } from "../user-name-context";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

function getSelectedIndex(selectedAnswer: SelectedAnswer | undefined): number | null {
  if (selectedAnswer?.kind !== "multipleChoice") {
    return null;
  }

  return selectedAnswer.selectedIndex;
}

function StepTextGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 sm:gap-6">{children}</div>;
}

function OptionList({
  onSelect,
  options,
  selectedIndex,
}: {
  onSelect: (index: number) => void;
  options: readonly { text: string }[];
  selectedIndex: number | null;
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
      {options.map((option, index) => (
        <OptionCard
          index={index}
          isSelected={selectedIndex === index}
          key={option.text}
          onSelect={() => onSelect(index)}
        >
          <span className="text-base leading-6">{option.text}</span>
        </OptionCard>
      ))}
    </div>
  );
}

function CoreVariant({
  content,
  onSelect,
  selectedIndex,
}: {
  content: CoreMultipleChoiceContent;
  onSelect: (index: number) => void;
  selectedIndex: number | null;
}) {
  const replaceName = useReplaceName();

  return (
    <>
      <StepTextGroup>
        {content.context && <ContextText>{replaceName(content.context)}</ContextText>}
        {content.question && <QuestionText>{replaceName(content.question)}</QuestionText>}
      </StepTextGroup>

      <OptionList onSelect={onSelect} options={content.options} selectedIndex={selectedIndex} />
    </>
  );
}

export function MultipleChoiceStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = parseStepContent("multipleChoice", step.content);
  const selectedIndex = getSelectedIndex(selectedAnswer);

  const handleSelect = (index: number) => {
    const selectedText = content.options[index]?.text ?? "";
    onSelectAnswer(step.id, { kind: "multipleChoice", selectedIndex: index, selectedText });
  };

  useOptionKeyboard({
    enabled: selectedAnswer === undefined || selectedAnswer.kind === "multipleChoice",
    onSelect: handleSelect,
    optionCount: content.options.length,
  });

  return (
    <InteractiveStepLayout>
      <CoreVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
    </InteractiveStepLayout>
  );
}
