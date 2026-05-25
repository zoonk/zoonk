"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describePlayerStep, getPlayerStepImage } from "../player-step";
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

function TextVariant({ title, text }: { title: string; text: string }) {
  return (
    <PlayerReadSceneStack>
      <PlayerReadSceneTitle>{title}</PlayerReadSceneTitle>
      <PlayerReadSceneBody>{text}</PlayerReadSceneBody>
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

  if (descriptor.kind !== "staticText") {
    return null;
  }

  return <TextVariant text={descriptor.content.text} title={descriptor.content.title} />;
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
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind === "intro") {
    return (
      <StepIntroHero
        image={descriptor.intro.image}
        text={descriptor.intro.text}
        title={descriptor.intro.title}
      />
    );
  }

  const content = <StaticStepContent step={step} />;
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
