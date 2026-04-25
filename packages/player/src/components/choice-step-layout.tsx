"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { ExpandableStepImageStage } from "./expandable-step-image-stage";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneContext,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { StepActionButton } from "./step-action-button";

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
  selectedKey,
}: {
  context?: string | null;
  onSelect: (key: string) => void;
  options: readonly { key: string; text: string }[];
  question?: string | null;
  selectedKey: string | null;
}) {
  const hasSelection = selectedKey !== null;

  const handleSelect = (index: number) => {
    const option = options[index];

    if (!option) {
      return;
    }

    onSelect(option.key);
  };

  return (
    <>
      {(context || question) && (
        <PlayerChoiceScenePrompt>
          <PlayerChoiceSceneContext>{context}</PlayerChoiceSceneContext>
          <PlayerChoiceSceneQuestion>{question}</PlayerChoiceSceneQuestion>
        </PlayerChoiceScenePrompt>
      )}

      <PlayerChoiceSceneOptions
        onSelect={handleSelect}
        options={options.map((option) => ({
          content: <PlayerChoiceSceneOptionText>{option.text}</PlayerChoiceSceneOptionText>,
          isDimmed: hasSelection && selectedKey !== option.key,
          isSelected: selectedKey === option.key,
          key: option.key,
        }))}
      />
    </>
  );
}

/**
 * Choice steps keep the image inset on mobile, where the learner needs to scan
 * one vertical flow, then let the same image bleed through the full left
 * column on desktop where there is enough room to separate evidence and action.
 */
function ChoiceStepImageStage({ image }: { image: StepImage }) {
  return (
    <div className="w-full lg:h-full lg:min-h-0" data-slot="choice-step-image-stage-shell">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl lg:aspect-auto lg:h-full lg:rounded-none [&_img]:object-top"
        data-slot="choice-step-image-stage"
      >
        <ExpandableStepImageStage image={image} />
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
 * Visual practice questions use the normal compact mobile stack, then become a
 * full-height image/text split on desktop. That keeps small screens familiar
 * while making large screens feel intentionally image-led instead of showing a
 * small square artifact inside a wide empty stage.
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
      className="mx-auto my-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:my-0 lg:h-full lg:max-w-none lg:p-0"
      data-slot="choice-step-media-layout"
    >
      <div className="flex flex-col gap-4 sm:gap-6 lg:grid lg:h-full lg:grid-cols-2 lg:gap-0">
        <ChoiceStepImageStage image={image} />
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-10 lg:py-10">
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:mx-auto lg:my-auto lg:w-full lg:max-w-md">
            {children}
            <ChoiceStepDesktopAction />
          </div>
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
  selectedKey,
}: {
  context?: string | null;
  image?: StepImage | null;
  onSelect: (key: string) => void;
  options: readonly { key: string; text: string }[];
  question?: string | null;
  selectedKey: string | null;
}) {
  const content = (
    <ChoiceStepLayoutContent
      context={context}
      onSelect={onSelect}
      options={options}
      question={question}
      selectedKey={selectedKey}
    />
  );

  if (!image) {
    return <PlayerChoiceScene>{content}</PlayerChoiceScene>;
  }

  return <ChoiceStepMediaLayout image={image}>{content}</ChoiceStepMediaLayout>;
}
