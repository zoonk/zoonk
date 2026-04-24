"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describePlayerStep } from "../player-step";
import { useReplaceName } from "../user-name-context";
import { HighlightText } from "./highlight-text";
import {
  PlayerReadScene,
  PlayerReadSceneBody,
  PlayerReadSceneStack,
  PlayerReadSceneTitle,
} from "./player-read-scene";
import { RomanizationText } from "./romanization-text";
import { StaticStepLayout } from "./static-step-layout";
import { StepIntroHero } from "./step-intro-hero-layout";
import { StoryOutcomeContent } from "./story-outcome-content";

function getStaticDescriptorImage(descriptor: ReturnType<typeof describePlayerStep>) {
  if (
    descriptor?.kind === "staticText" ||
    descriptor?.kind === "staticGrammarExample" ||
    descriptor?.kind === "staticGrammarRule"
  ) {
    return descriptor.content.image;
  }
}

function TextVariant({ title, text }: { title: string; text: string }) {
  const replaceName = useReplaceName();

  return (
    <PlayerReadSceneStack>
      <PlayerReadSceneTitle>{replaceName(title)}</PlayerReadSceneTitle>
      <PlayerReadSceneBody>{replaceName(text)}</PlayerReadSceneBody>
    </PlayerReadSceneStack>
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
    <PlayerReadSceneStack>
      <p className="text-xl font-medium sm:text-2xl">
        <HighlightText highlight={highlight} text={sentence} />
      </p>

      <RomanizationText>{romanization}</RomanizationText>

      <PlayerReadSceneBody>{translation}</PlayerReadSceneBody>
    </PlayerReadSceneStack>
  );
}

function GrammarRuleVariant({ ruleName, ruleSummary }: { ruleName: string; ruleSummary: string }) {
  return (
    <PlayerReadSceneStack>
      <PlayerReadSceneTitle>{ruleName}</PlayerReadSceneTitle>
      <PlayerReadSceneBody>{ruleSummary}</PlayerReadSceneBody>
    </PlayerReadSceneStack>
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

  if (descriptor.kind !== "staticText") {
    return null;
  }

  return <TextVariant text={descriptor.content.text} title={descriptor.content.title} />;
}

export function StaticStep({ step }: { step: SerializedStep }) {
  const descriptor = describePlayerStep(step);
  const image = getStaticDescriptorImage(descriptor);

  if (descriptor?.kind === "intro") {
    return (
      <StepIntroHero
        image={descriptor.intro.image}
        text={descriptor.intro.text}
        title={descriptor.intro.title}
      />
    );
  }

  if (descriptor?.kind === "storyOutcome") {
    return <StoryOutcomeContent outcomes={descriptor.content.outcomes} />;
  }

  const content = <StaticStepContent step={step} />;

  if (!image) {
    return <PlayerReadScene className="w-full">{content}</PlayerReadScene>;
  }

  return (
    <div className="flex h-full w-full flex-1">
      <StaticStepLayout image={image}>{content}</StaticStepLayout>
    </div>
  );
}
