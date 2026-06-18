"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { usePlayerLessonMeta, usePlayerRuntime } from "../player-context";
import { describePlayerStep, getPlayerStepImage } from "../player-step";
import {
  getGrammarExplanationSentenceLines,
  isInitialGrammarExplanationStep,
} from "./_utils/grammar-explanation-lines";
import { HighlightText } from "./highlight-text";
import {
  PlayerReadScene,
  PlayerReadSceneBody,
  PlayerReadSceneStack,
  PlayerReadSceneTitle,
} from "./player-read-scene";
import { PlayerRichText } from "./player-rich-text";
import { RomanizationText } from "./romanization-text";
import { StaticStepLayout } from "./static-step-layout";
import { StepIntroHero } from "./step-intro-hero-layout";

/**
 * Renders one display sentence with the same rich-text support as regular
 * player copy. Grammar explanations can include target-word code markers,
 * emphasis, or formulas, so splitting the text must not downgrade formatting.
 */
function SentenceLine({ sentence }: { sentence: string }) {
  return (
    <span className="block">
      <PlayerRichText text={sentence} />
    </span>
  );
}

/**
 * Adds a small pause between generated explanation sentences. The wrapper stays
 * inline-compatible with the existing paragraph body while visually making each
 * sentence scan as its own line.
 */
function SentenceLineGroup({ sentences }: { sentences: string[] }) {
  return (
    <span className="block space-y-3">
      {sentences.map((sentence, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Sentence lines come from immutable generated text and never reorder after render.
        <SentenceLine key={`${sentence}-${index}`} sentence={sentence} />
      ))}
    </span>
  );
}

function TextVariant({
  sentenceLines,
  title,
  text,
}: {
  sentenceLines: string[] | null;
  title: string;
  text: string;
}) {
  return (
    <PlayerReadSceneStack>
      <PlayerReadSceneTitle>{title}</PlayerReadSceneTitle>
      <PlayerReadSceneBody>
        {sentenceLines ? <SentenceLineGroup sentences={sentenceLines} /> : text}
      </PlayerReadSceneBody>
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

/**
 * Returns sentence lines only for the leading grammar explanation block. The
 * guard keeps the visual treatment away from regular static lessons, grammar
 * examples, and any static text that may appear after examples or questions.
 */
function getStaticTextSentenceLines({
  lessonKind,
  step,
  steps,
}: {
  lessonKind: LessonKind;
  step: SerializedStep;
  steps: SerializedStep[];
}) {
  const descriptor = describePlayerStep(step);

  if (
    descriptor?.kind !== "staticText" ||
    !isInitialGrammarExplanationStep({ lessonKind, step, steps })
  ) {
    return null;
  }

  return getGrammarExplanationSentenceLines(descriptor.content.text);
}

function StaticStepContent({
  sentenceLines,
  step,
}: {
  sentenceLines: string[] | null;
  step: SerializedStep;
}) {
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

  if (descriptor.kind !== "staticText") {
    return null;
  }

  return (
    <TextVariant
      sentenceLines={sentenceLines}
      text={descriptor.content.text}
      title={descriptor.content.title}
    />
  );
}

/**
 * Text-only static steps sit inside the swipe navigation frame, which keeps the
 * outer stage overflow locked. This inner frame gives long explanations their
 * own vertical scroll area while preserving centered layout for short copy.
 */
function TextOnlyStaticScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
      <PlayerReadScene className="w-full">{children}</PlayerReadScene>
    </div>
  );
}

export function StaticStep({ step }: { step: SerializedStep }) {
  const lessonMeta = usePlayerLessonMeta();
  const { state } = usePlayerRuntime();
  const descriptor = describePlayerStep(step);

  const sentenceLines = getStaticTextSentenceLines({
    lessonKind: lessonMeta.kind,
    step,
    steps: state.steps,
  });

  if (descriptor?.kind === "intro") {
    return (
      <StepIntroHero
        image={descriptor.intro.image}
        text={descriptor.intro.text}
        title={descriptor.intro.title}
      />
    );
  }

  const content = <StaticStepContent sentenceLines={sentenceLines} step={step} />;
  const image = getPlayerStepImage(descriptor);

  if (!image) {
    return <TextOnlyStaticScene>{content}</TextOnlyStaticScene>;
  }

  return (
    <div className="flex h-full w-full flex-1">
      <StaticStepLayout image={image}>{content}</StaticStepLayout>
    </div>
  );
}
