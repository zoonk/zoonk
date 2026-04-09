"use client";

import { describePlayerStep } from "../player-step";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import { HighlightText } from "./highlight-text";
import { ContextText, QuestionText } from "./question-text";
import { RomanizationText } from "./romanization-text";
import { StoryIntroContent } from "./story-intro-content";
import { StoryOutcomeContent } from "./story-outcome-content";

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
  const descriptor = describePlayerStep(step);

  if (!descriptor) {
    return null;
  }

  if (descriptor.kind === "staticGrammarExample") {
    return (
      <GrammarExampleVariant
        highlight={descriptor.content.highlight}
        romanization={descriptor.content.romanization}
        sentence={descriptor.content.sentence}
        translation={descriptor.content.translation}
      />
    );
  }

  if (descriptor.kind === "staticGrammarRule") {
    return (
      <GrammarRuleVariant
        ruleName={descriptor.content.ruleName}
        ruleSummary={descriptor.content.ruleSummary}
      />
    );
  }

  if (descriptor.kind === "storyIntro") {
    return (
      <StoryIntroContent intro={descriptor.content.intro} metrics={descriptor.content.metrics} />
    );
  }

  if (descriptor.kind === "storyOutcome") {
    return <StoryOutcomeContent outcomes={descriptor.content.outcomes} />;
  }

  if (descriptor.kind !== "staticText") {
    return null;
  }

  return <TextVariant text={descriptor.content.text} title={descriptor.content.title} />;
}

export function StaticStep({ step }: { step: SerializedStep }) {
  return (
    <div className="relative flex min-h-0 w-full max-w-2xl flex-1 flex-col items-start justify-center gap-3 px-8 sm:px-10">
      <StaticStepContent step={step} />
    </div>
  );
}
