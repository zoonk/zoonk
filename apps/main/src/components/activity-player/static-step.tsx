"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { HighlightText } from "./highlight-text";
import { StaticStepText, StaticStepVisual } from "./step-layouts";

function TextVariant({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
      <p className="text-muted-foreground text-base">{text}</p>
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
      <p className="text-2xl font-medium sm:text-3xl">
        <HighlightText highlight={highlight} text={sentence} />
      </p>

      {romanization && <p className="text-muted-foreground text-sm italic">{romanization}</p>}

      <p className="text-muted-foreground mt-3 text-base">{translation}</p>
    </>
  );
}

function GrammarRuleVariant({ ruleName, ruleSummary }: { ruleName: string; ruleSummary: string }) {
  return (
    <>
      <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{ruleName}</h2>
      <p className="text-muted-foreground text-base">{ruleSummary}</p>
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
