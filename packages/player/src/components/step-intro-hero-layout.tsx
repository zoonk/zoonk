"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import {
  PlayerReadScene,
  PlayerReadSceneBody,
  PlayerReadSceneStack,
  PlayerReadSceneTitle,
} from "./player-read-scene";
import { StepActionButton } from "./step-action-button";
import { StepImageView } from "./step-image";

/**
 * Shared intro copy for practice opening screens.
 *
 * Practice introductions should feel like one clear player moment: read the
 * setup, then start from the CTA inside the bottom card. Rendering this copy
 * in one place keeps title handling, name replacement, labels, and action
 * placement from drifting.
 */
function StepIntroHeroContent({ text, title }: { text: string; title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PlayerReadSceneStack>
        <PlayerReadSceneTitle tone="foreground">{title}</PlayerReadSceneTitle>

        <PlayerReadSceneBody>{text}</PlayerReadSceneBody>
      </PlayerReadSceneStack>

      <StepActionButton />
    </div>
  );
}

/**
 * Hero illustrations behave like the scene behind the practice setup.
 *
 * Practice intros need the image to fill the whole available stage because the
 * picture is the scenario context, not a contained diagram. The readable setup
 * stays in the overlay card so the image can keep bleeding to every edge.
 */
function StepHeroImage({ image }: { image: StepImage }) {
  return (
    <div className="bg-muted absolute inset-0 overflow-hidden" data-slot="step-hero-image">
      <StepImageView fit="cover" image={image} />
    </div>
  );
}

/**
 * The hero card owns the readable content and embedded CTA.
 *
 * The outer layer keeps the card pinned to the bottom so the image can fill the
 * rest of the frame. Desktop keeps the same overlay model instead of switching
 * back to the regular static-step composition.
 */
function StepHeroCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-0 sm:px-6 lg:px-8 lg:pb-8"
      data-slot="step-hero-card-shell"
    >
      <div
        className="bg-background pointer-events-auto max-h-[70dvh] w-full max-w-2xl overflow-y-auto rounded-t-4xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 sm:pb-[max(2rem,env(safe-area-inset-bottom))] lg:max-h-[48dvh] lg:rounded-3xl lg:p-8"
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
 * Image-backed intros use one full-stage composition across breakpoints. That
 * keeps practice scenarios visually distinct from regular static images and
 * avoids a second desktop-only media policy.
 */
function StepHero({ children, image }: { children: React.ReactNode; image?: StepImage | null }) {
  if (!image) {
    return (
      <div className="flex h-full w-full flex-1 overflow-y-auto">
        <PlayerReadScene className="w-full">{children}</PlayerReadScene>
      </div>
    );
  }

  return (
    <div
      className="relative h-full min-h-0 w-full flex-1 self-stretch overflow-hidden"
      data-slot="step-hero-layout"
    >
      <StepHeroImage image={image} />
      <StepHeroCard>{children}</StepHeroCard>
    </div>
  );
}

/**
 * Practice introductions keep this small wrapper so the scenario title/body
 * structure stays consistent wherever the hero frame is used.
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
