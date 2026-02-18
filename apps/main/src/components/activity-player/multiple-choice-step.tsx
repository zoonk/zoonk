"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import {
  type ChallengeMultipleChoiceContent,
  type CoreMultipleChoiceContent,
  type LanguageMultipleChoiceContent,
  type MultipleChoiceStepContent,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { useExtracted } from "next-intl";
import { InlineFeedback } from "./inline-feedback";
import { OptionCard } from "./option-card";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { ContextText, QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";
import { useOptionKeyboard } from "./use-option-keyboard";
import { useReplaceName } from "./user-name-context";

function getSelectedIndex(selectedAnswer: SelectedAnswer | undefined): number | null {
  if (selectedAnswer?.kind !== "multipleChoice") {
    return null;
  }

  return selectedAnswer.selectedIndex;
}

function getOptionResultState(
  index: number,
  content: MultipleChoiceStepContent,
  selectedIndex: number,
): "correct" | "incorrect" | undefined {
  if (content.kind === "challenge") {
    return undefined;
  }

  if (content.options[index]?.isCorrect) {
    return "correct";
  }

  if (index === selectedIndex) {
    return "incorrect";
  }

  return undefined;
}

function StepTextGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 sm:gap-6">{children}</div>;
}

function OptionContent({ romanization, text }: { romanization?: string | null; text: string }) {
  return (
    <>
      <span className="text-base leading-6">{text}</span>

      {romanization && <span className="text-muted-foreground text-sm italic">{romanization}</span>}
    </>
  );
}

function OptionList({
  content,
  disabled,
  onSelect,
  options,
  selectedIndex,
}: {
  content: MultipleChoiceStepContent;
  disabled: boolean;
  onSelect: (index: number) => void;
  options: readonly { text: string; textRomanization?: string | null }[];
  selectedIndex: number | null;
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
      {options.map((option, index) => (
        <OptionCard
          disabled={disabled}
          index={index}
          isSelected={selectedIndex === index}
          key={option.text}
          onSelect={() => onSelect(index)}
          resultState={
            disabled && selectedIndex !== null
              ? getOptionResultState(index, content, selectedIndex)
              : undefined
          }
        >
          <OptionContent
            romanization={"textRomanization" in option ? option.textRomanization : undefined}
            text={option.text}
          />
        </OptionCard>
      ))}
    </div>
  );
}

function CoreVariant({
  content,
  disabled,
  onSelect,
  result,
  selectedIndex,
}: {
  content: CoreMultipleChoiceContent;
  disabled: boolean;
  onSelect: (index: number) => void;
  result?: StepResult;
  selectedIndex: number | null;
}) {
  const replaceName = useReplaceName();

  return (
    <>
      <StepTextGroup>
        {content.context && <ContextText>{replaceName(content.context)}</ContextText>}
        {content.question && <QuestionText>{replaceName(content.question)}</QuestionText>}
      </StepTextGroup>

      <OptionList
        content={content}
        disabled={disabled}
        onSelect={onSelect}
        options={content.options}
        selectedIndex={selectedIndex}
      />

      {result && <InlineFeedback result={result} />}
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

      <OptionList
        content={content}
        disabled={false}
        onSelect={onSelect}
        options={content.options}
        selectedIndex={selectedIndex}
      />
    </>
  );
}

function SpeechBubble({ children }: { children: React.ReactNode }) {
  return <div className="bg-muted flex flex-col gap-1 rounded-2xl px-4 py-3">{children}</div>;
}

function LanguageVariant({
  content,
  disabled,
  onSelect,
  result,
  selectedIndex,
}: {
  content: LanguageMultipleChoiceContent;
  disabled: boolean;
  onSelect: (index: number) => void;
  result?: StepResult;
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
        <OptionList
          content={content}
          disabled={disabled}
          onSelect={onSelect}
          options={content.options}
          selectedIndex={selectedIndex}
        />
      </div>

      {result && <InlineFeedback result={result} />}
    </>
  );
}

export function MultipleChoiceStep({
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
  const content = parseStepContent("multipleChoice", step.content);
  const selectedIndex = getSelectedIndex(selectedAnswer);
  const hasResult = Boolean(result);

  const handleSelect = (index: number) => {
    if (result) {
      return;
    }

    onSelectAnswer(step.id, { kind: "multipleChoice", selectedIndex: index });
  };

  useOptionKeyboard({
    enabled: !result && (selectedAnswer === undefined || selectedAnswer.kind === "multipleChoice"),
    onSelect: handleSelect,
    optionCount: content.options.length,
  });

  return (
    <InteractiveStepLayout>
      {content.kind === "challenge" && (
        <ChallengeVariant content={content} onSelect={handleSelect} selectedIndex={selectedIndex} />
      )}

      {content.kind === "core" && (
        <CoreVariant
          content={content}
          disabled={hasResult}
          onSelect={handleSelect}
          result={result}
          selectedIndex={selectedIndex}
        />
      )}

      {content.kind === "language" && (
        <LanguageVariant
          content={content}
          disabled={hasResult}
          onSelect={handleSelect}
          result={result}
          selectedIndex={selectedIndex}
        />
      )}
    </InteractiveStepLayout>
  );
}
