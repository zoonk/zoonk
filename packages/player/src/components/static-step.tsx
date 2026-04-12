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
import { StoryIntroContent } from "./story-intro-content";
import { StoryOutcomeContent } from "./story-outcome-content";

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
    <PlayerReadScene>
      <StaticStepContent step={step} />
    </PlayerReadScene>
  );
}
