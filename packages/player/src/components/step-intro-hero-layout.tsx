"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { useReplaceName } from "../user-name-context";
import { ExpandableStepImageStage } from "./expandable-step-image-stage";
import {
  PlayerReadScene,
  PlayerReadSceneBody,
  PlayerReadSceneStack,
  PlayerReadSceneTitle,
} from "./player-read-scene";
import { StepActionButton } from "./step-action-button";

/**
 * Shared intro copy for story and practice opening screens.
 *
 * Both activity types should feel like the same player moment: read the setup,
 * then start from the CTA inside the bottom card. Rendering this copy in one
 * place keeps title handling, name replacement, labels, and action placement
 * from drifting between story and practice.
 */
function StepIntroHeroContent({ text, title }: { text: string; title: string }) {
  const replaceName = useReplaceName();

  return (
    <div className="flex flex-col gap-6">
      <PlayerReadSceneStack>
        <PlayerReadSceneTitle tone="foreground">{replaceName(title)}</PlayerReadSceneTitle>

        <PlayerReadSceneBody>{replaceName(text)}</PlayerReadSceneBody>
      </PlayerReadSceneStack>

      <StepActionButton />
    </div>
  );
}

/**
 * Hero illustrations are immersive on mobile and composed on desktop.
 *
 * Small screens keep the image as a full-bleed background. Large screens reuse
 * the feedback-screen treatment: a centered, rounded square image above the
 * content so the generated scene feels intentional instead of oversized.
 */
function StepHeroImage({ image }: { image: StepImage }) {
  return (
    <div
      className="bg-muted absolute inset-0 overflow-hidden lg:relative lg:inset-auto lg:aspect-square lg:w-full lg:rounded-3xl"
      data-slot="step-hero-image"
    >
      <ExpandableStepImageStage fit="cover" image={image} />
    </div>
  );
}

/**
 * The hero card owns the readable content and embedded CTA.
 *
 * The outer layer keeps the card pinned to the bottom and centered on larger
 * touch screens. Desktop removes the card chrome and lets the content sit
 * below the image like feedback screens.
 */
function StepHeroCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-0 sm:px-6 lg:pointer-events-auto lg:static lg:block lg:px-0"
      data-slot="step-hero-card-shell"
    >
      <div
        className="bg-background pointer-events-auto max-h-[70dvh] w-full max-w-2xl overflow-y-auto rounded-t-4xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 sm:pb-[max(2rem,env(safe-area-inset-bottom))] lg:max-h-none lg:max-w-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0"
        data-slot="step-hero-card"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shared responsive image/card frame for immersive static steps.
 *
 * Mobile uses a full-screen image with a bottom card, while desktop uses the
 * feedback-style centered image stack. Keeping that structure here prevents
 * intro and outcome screens from accumulating separate layout rules over time.
 */
export function StepHero({
  children,
  image,
}: {
  children: React.ReactNode;
  image?: StepImage | null;
}) {
  if (!image) {
    return (
      <div className="flex h-full w-full flex-1 overflow-y-auto">
        <PlayerReadScene className="w-full">{children}</PlayerReadScene>
      </div>
    );
  }

  return (
    <div
      className="relative h-full min-h-0 w-full flex-1 self-stretch overflow-hidden lg:my-auto lg:flex lg:h-auto lg:max-w-2xl lg:flex-none lg:flex-col lg:gap-6 lg:self-center lg:overflow-visible lg:px-4 lg:py-6"
      data-slot="step-hero-layout"
    >
      <StepHeroImage image={image} />
      <StepHeroCard>{children}</StepHeroCard>
    </div>
  );
}

/**
 * Story and practice introductions share the same copy treatment.
 *
 * Outcome screens reuse the hero frame directly, but intros keep this small
 * wrapper so the scenario title/body structure stays identical across story
 * and practice.
 */
export function StepIntroHero({
  image,
  text,
  title,
}: {
  image?: StepImage | null;
  text: string;
  title: string;
}) {
  return (
    <StepHero image={image}>
      <StepIntroHeroContent text={text} title={title} />
    </StepHero>
  );
}
