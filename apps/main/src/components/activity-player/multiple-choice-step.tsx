"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import {
  type ChallengeMultipleChoiceContent,
  type CoreMultipleChoiceContent,
  type LanguageMultipleChoiceContent,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { type SelectedAnswer } from "./player-reducer";
import { InteractiveStepLayout } from "./step-layouts";
import { useOptionKeyboard } from "./use-option-keyboard";

function getSelectedIndex(selectedAnswer: SelectedAnswer | undefined): number | null {
  if (selectedAnswer?.kind !== "multipleChoice") {
    return null;
  }

  return selectedAnswer.selectedIndex;
}

function QuestionText({ children }: { children: React.ReactNode }) {
  return <p className="text-base font-semibold">{children}</p>;
}

function ContextText({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-base">{children}</p>;
}

function StepTextGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 sm:gap-6">{children}</div>;
}

function OptionGroup({ children }: { children: React.ReactNode }) {
  return (
    <div aria-label="Answer options" className="flex flex-col gap-3" role="radiogroup">
      {children}
    </div>
  );
}

function OptionCard({
  index,
  isSelected,
  onSelect,
  romanization,
  text,
}: {
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  romanization?: string | null;
  text: string;
}) {
  return (
    <button
      aria-checked={isSelected}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
      )}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <Kbd aria-hidden="true" className={cn(isSelected && "bg-primary text-primary-foreground")}>
        {index + 1}
      </Kbd>

      <div className="flex flex-col">
        <span className="text-base leading-6">{text}</span>

        {romanization ? (
          <span className="text-muted-foreground text-sm italic">{romanization}</span>
        ) : null}
      </div>
    </button>
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
  return (
    <>
      <StepTextGroup>
        {content.context ? <ContextText>{content.context}</ContextText> : null}
        {content.question ? <QuestionText>{content.question}</QuestionText> : null}
      </StepTextGroup>

      <OptionGroup>
        {content.options.map((option, index) => (
          <OptionCard
            index={index}
            isSelected={selectedIndex === index}
            key={option.text}
            onSelect={() => onSelect(index)}
            text={option.text}
          />
        ))}
      </OptionGroup>
    </>
  );
}

function ChallengeVariant({
  content,
  onSelect,
  selectedIndex,
}: {
  content: ChallengeMultipleChoiceContent;
  onSelect: (index: number) => void;
  selectedIndex: number | null;
}) {
  return (
    <>
      <StepTextGroup>
        <ContextText>{content.context}</ContextText>
        <QuestionText>{content.question}</QuestionText>
      </StepTextGroup>

      <OptionGroup>
        {content.options.map((option, index) => (
          <OptionCard
            index={index}
            isSelected={selectedIndex === index}
            key={option.text}
            onSelect={() => onSelect(index)}
            text={option.text}
          />
        ))}
      </OptionGroup>
    </>
  );
}

function LanguageVariant({
  content,
  onSelect,
  selectedIndex,
}: {
  content: LanguageMultipleChoiceContent;
  onSelect: (index: number) => void;
  selectedIndex: number | null;
}) {
  return (
    <>
      <StepTextGroup>
        <QuestionText>{content.context}</QuestionText>

        {content.contextRomanization && (
          <p className="text-muted-foreground text-sm italic">{content.contextRomanization}</p>
        )}

        <ContextText>{content.contextTranslation}</ContextText>
      </StepTextGroup>

      <OptionGroup>
        {content.options.map((option, index) => (
          <OptionCard
            index={index}
            isSelected={selectedIndex === index}
            key={option.text}
            onSelect={() => onSelect(index)}
            romanization={option.textRomanization}
            text={option.text}
          />
        ))}
      </OptionGroup>
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
    onSelectAnswer(step.id, { kind: "multipleChoice", selectedIndex: index });
  };

  useOptionKeyboard({
    enabled: selectedAnswer === undefined || selectedAnswer.kind === "multipleChoice",
    onSelect: handleSelect,
    optionCount: content.options.length,
  });

  return (
    <InteractiveStepLayout>
      {content.kind === "challenge" ? (
        <ChallengeVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
      ) : null}

      {content.kind === "core" ? (
        <CoreVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
      ) : null}

      {content.kind === "language" ? (
        <LanguageVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
      ) : null}
    </InteractiveStepLayout>
  );
}
