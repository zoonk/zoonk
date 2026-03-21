"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import { HighlightText } from "./highlight-text";
import { ContextText, QuestionText } from "./question-text";
import { RomanizationText } from "./romanization-text";

function TextVariant({ title, text }: { title: string; text: string }) {
  const replaceName = useReplaceName();

  return (
    <>
      <QuestionText>{replaceName(title)}</QuestionText>
      <ContextText>{replaceName(text)}</ContextText>
    </>
  );
}

function GrammarExampleVariant({
  highlight,
  romanization,
  sentence,
  translation,
}: {
  highlight: string;
  romanization: string | null;
  sentence: string;
  translation: string;
}) {
  return (
    <>
      <p className="text-xl font-medium sm:text-2xl">
        <HighlightText highlight={highlight} text={sentence} />
      </p>

      <RomanizationText>{romanization}</RomanizationText>

      <ContextText>{translation}</ContextText>
    </>
  );
}

function GrammarRuleVariant({ ruleName, ruleSummary }: { ruleName: string; ruleSummary: string }) {
  return (
    <>
      <QuestionText>{ruleName}</QuestionText>
      <ContextText>{ruleSummary}</ContextText>
    </>
  );
}

function StaticStepContent({ step }: { step: SerializedStep }) {
  const content = parseStepContent("static", step.content);

  if (content.variant === "grammarExample") {
    return (
      <GrammarExampleVariant
        highlight={content.highlight}
        romanization={content.romanization}
        sentence={content.sentence}
        translation={content.translation}
      />
    );
  }

  if (content.variant === "grammarRule") {
    return <GrammarRuleVariant ruleName={content.ruleName} ruleSummary={content.ruleSummary} />;
  }

  return <TextVariant text={content.text} title={content.title} />;
}

export function StaticStep({ step }: { step: SerializedStep }) {
  return (
    <div className="relative flex min-h-0 w-full max-w-2xl flex-1 flex-col items-start justify-center gap-3 px-8 sm:px-10">
      <StaticStepContent step={step} />
    </div>
  );
}
