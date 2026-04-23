"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneContext,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { StepActionButton } from "./step-action-button";
import { StepImageView } from "./step-image";

/**
 * The prompt and option list are the reusable heart of every choice scene.
 * Keeping them separate from the outer layout lets the same content render in
 * the classic text-only shell or the newer image-led split layout.
 */
function ChoiceStepLayoutContent({
  context,
  onSelect,
  options,
  question,
  selectedIndex,
}: {
  context?: string | null;
  onSelect: (index: number) => void;
  options: readonly { key: string; text: string }[];
  question?: string | null;
  selectedIndex: number | null;
}) {
  const hasSelection = selectedIndex !== null;

  return (
    <>
      {(context || question) && (
        <PlayerChoiceScenePrompt>
          <PlayerChoiceSceneContext>{context}</PlayerChoiceSceneContext>
          <PlayerChoiceSceneQuestion>{question}</PlayerChoiceSceneQuestion>
        </PlayerChoiceScenePrompt>
      )}

      <PlayerChoiceSceneOptions
        onSelect={onSelect}
        options={options.map((option, index) => ({
          content: <PlayerChoiceSceneOptionText>{option.text}</PlayerChoiceSceneOptionText>,
          isDimmed: hasSelection && selectedIndex !== index,
          isSelected: selectedIndex === index,
          key: option.key,
        }))}
      />
    </>
  );
}

/**
 * Choice steps need a different image composition than read-only steps.
 *
 * Practice questions need the artifact visible before the learner scans the
 * options on mobile, but large screens have enough room to sit the evidence
 * beside the decision. Keeping that responsive image stage here avoids making
 * the rest of the choice layout care about viewport-specific composition.
 */
function ChoiceStepImageStage({ image }: { image: StepImage }) {
  return (
    <div
      className="w-full lg:ml-auto lg:max-w-md xl:max-w-120"
      data-slot="choice-step-image-stage-shell"
    >
      <div
        className="relative aspect-square w-full [&_img]:object-top"
        data-slot="choice-step-image-stage"
      >
        <StepImageView image={image} />
      </div>
    </div>
  );
}

/**
 * Image-led choice steps need their desktop action button inside the same
 * reading column as the prompt and options. Keeping that button local to the
 * step lets the right column stay visually self-contained while mobile still
 * uses the shared sticky bottom bar.
 */
function ChoiceStepDesktopAction() {
  return <StepActionButton className="hidden lg:flex" />;
}

/**
 * Visual practice questions need a wider stage than text-only choice scenes.
 *
 * The centered text frame is correct for normal multiple-choice questions, but
 * image-led steps need the same kind of horizontal space as static media steps
 * so the artifact can stay large while the prompt, options, and desktop action
 * remain grouped in one compact column.
 */
function ChoiceStepMediaLayout({
  children,
  image,
}: {
  children: React.ReactNode;
  image: StepImage;
}) {
  return (
    <div
      className="mx-auto my-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6"
      data-slot="choice-step-media-layout"
    >
      <div className="flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,25rem)] lg:items-start lg:gap-8 xl:gap-10">
        <ChoiceStepImageStage image={image} />
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          {children}
          <ChoiceStepDesktopAction />
        </div>
      </div>
    </div>
  );
}

/**
 * Shared layout for choice-based steps (multiple choice, story decisions).
 *
 * Owns all rendering and interaction: text display, option list with dimming,
 * numeric keyboard shortcuts, and toggle-to-unselect. Each step kind provides
 * a thin wrapper that parses its content and builds the answer shape.
 */
export function ChoiceStepLayout({
  context,
  image,
  onSelect,
  options,
  question,
  selectedIndex,
}: {
  context?: string | null;
  image?: StepImage | null;
  onSelect: (index: number) => void;
  options: readonly { key: string; text: string }[];
  question?: string | null;
  selectedIndex: number | null;
}) {
  const content = (
    <ChoiceStepLayoutContent
      context={context}
      onSelect={onSelect}
      options={options}
      question={question}
      selectedIndex={selectedIndex}
    />
  );

  if (!image) {
    return <PlayerChoiceScene>{content}</PlayerChoiceScene>;
  }

  return <ChoiceStepMediaLayout image={image}>{content}</ChoiceStepMediaLayout>;
}
