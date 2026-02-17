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
import { useExtracted } from "next-intl";
import { type SelectedAnswer } from "./player-reducer";
import { ContextText, QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useOptionKeyboard } from "./use-option-keyboard";
import { useReplaceName } from "./user-name-context";

function getSelectedIndex(selectedAnswer: SelectedAnswer | undefined): number | null {
  if (selectedAnswer?.kind !== "multipleChoice") {
    return null;
  }

  return selectedAnswer.selectedIndex;
}

function StepTextGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 sm:gap-6">{children}</div>;
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
        "focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
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

        {romanization && (
          <span className="text-muted-foreground text-sm italic">{romanization}</span>
        )}
      </div>
    </button>
  );
}

function OptionList({
  onSelect,
  options,
  selectedIndex,
}: {
  onSelect: (index: number) => void;
  options: readonly { text: string; textRomanization?: string | null }[];
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
          romanization={"textRomanization" in option ? option.textRomanization : undefined}
          text={option.text}
        />
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

function ChallengeVariant({
  content,
  onSelect,
  selectedIndex,
}: {
  content: ChallengeMultipleChoiceContent;
  onSelect: (index: number) => void;
  selectedIndex: number | null;
}) {
  const replaceName = useReplaceName();

  return (
    <>
      <StepTextGroup>
        <ContextText>{replaceName(content.context)}</ContextText>
        <QuestionText>{replaceName(content.question)}</QuestionText>
      </StepTextGroup>

      <OptionList onSelect={onSelect} options={content.options} selectedIndex={selectedIndex} />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{children}</p>
  );
}

function SpeechBubble({ children }: { children: React.ReactNode }) {
  return <div className="bg-muted flex flex-col gap-1 rounded-2xl px-4 py-3">{children}</div>;
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
  const t = useExtracted();
  const replaceName = useReplaceName();

  return (
    <>
      <div className="flex flex-col gap-2">
        <SectionLabel>{t("Someone says:")}</SectionLabel>

        <SpeechBubble>
          <p className="text-base font-semibold">{replaceName(content.context)}</p>

          {content.contextRomanization && (
            <p className="text-muted-foreground text-sm italic">{content.contextRomanization}</p>
          )}

          <p className="text-muted-foreground text-sm">{replaceName(content.contextTranslation)}</p>
        </SpeechBubble>
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>{t("What do you say?")}</SectionLabel>
        <OptionList onSelect={onSelect} options={content.options} selectedIndex={selectedIndex} />
      </div>
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
      {content.kind === "challenge" && (
        <ChallengeVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
      )}

      {content.kind === "core" && (
        <CoreVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
      )}

      {content.kind === "language" && (
        <LanguageVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
      )}
    </InteractiveStepLayout>
  );
}
