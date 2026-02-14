"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { HighlightText } from "./highlight-text";
import { ContextText } from "./question-text";
import { StaticStepText, StaticStepVisual } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

function TextVariant({ title, text }: { title: string; text: string }) {
  const replaceName = useReplaceName();

  return (
    <>
      <h2 className="text-base font-semibold">{replaceName(title)}</h2>
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

      {romanization && <p className="text-muted-foreground text-sm italic">{romanization}</p>}

      <ContextText>{translation}</ContextText>
    </>
  );
}

function GrammarRuleVariant({ ruleName, ruleSummary }: { ruleName: string; ruleSummary: string }) {
  return (
    <>
      <h2 className="text-base font-semibold tracking-tight">{ruleName}</h2>
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
    <>
      <StaticStepVisual />

      <StaticStepText className="px-6 pt-6 pb-8 sm:px-8 sm:pb-10">
        <StaticStepContent step={step} />
      </StaticStepText>
    </>
  );
}
