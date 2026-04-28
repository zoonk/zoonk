import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerStepDescriptor, type PlayerStepKind, describePlayerStep } from "./player-step";

export type PlayerCheckBehavior =
  | "fillBlank"
  | "listening"
  | "matchColumns"
  | "multipleChoice"
  | "none"
  | "reading"
  | "selectImage"
  | "sortOrder"
  | "translation";

type PlayerFeedbackBehavior = "inline" | "none" | "screen";
type PlayerLayoutBehavior = "default" | "hero" | "navigable";
type PlayerSceneBehavior = "choice" | "read";

export type PlayerRenderBehavior =
  | "fillBlank"
  | "listening"
  | "matchColumns"
  | "multipleChoice"
  | "reading"
  | "selectImage"
  | "sortOrder"
  | "static"
  | "translation"
  | "vocabulary";

type PlayerValidationBehavior =
  | "fillBlank"
  | "listening"
  | "matchColumns"
  | "multipleChoice"
  | "none"
  | "reading"
  | "selectImage"
  | "sortOrder"
  | "translation";

type PlayerStepBehavior = {
  check: PlayerCheckBehavior;
  feedback: PlayerFeedbackBehavior;
  layout: PlayerLayoutBehavior;
  render: PlayerRenderBehavior;
  scene: PlayerSceneBehavior;
  validation: PlayerValidationBehavior;
};

const STEP_BEHAVIOR_BY_KIND: Record<PlayerStepKind, PlayerStepBehavior> = {
  fillBlank: {
    check: "fillBlank",
    feedback: "inline",
    layout: "default",
    render: "fillBlank",
    scene: "choice",
    validation: "fillBlank",
  },
  intro: {
    check: "none",
    feedback: "none",
    layout: "hero",
    render: "static",
    scene: "read",
    validation: "none",
  },
  listening: {
    check: "listening",
    feedback: "screen",
    layout: "default",
    render: "listening",
    scene: "choice",
    validation: "listening",
  },
  matchColumns: {
    check: "matchColumns",
    feedback: "inline",
    layout: "default",
    render: "matchColumns",
    scene: "choice",
    validation: "matchColumns",
  },
  multipleChoice: {
    check: "multipleChoice",
    feedback: "screen",
    layout: "default",
    render: "multipleChoice",
    scene: "choice",
    validation: "multipleChoice",
  },
  reading: {
    check: "reading",
    feedback: "screen",
    layout: "default",
    render: "reading",
    scene: "choice",
    validation: "reading",
  },
  selectImage: {
    check: "selectImage",
    feedback: "inline",
    layout: "default",
    render: "selectImage",
    scene: "choice",
    validation: "selectImage",
  },
  sortOrder: {
    check: "sortOrder",
    feedback: "inline",
    layout: "default",
    render: "sortOrder",
    scene: "choice",
    validation: "sortOrder",
  },
  staticGrammarExample: {
    check: "none",
    feedback: "none",
    layout: "navigable",
    render: "static",
    scene: "read",
    validation: "none",
  },
  staticGrammarRule: {
    check: "none",
    feedback: "none",
    layout: "navigable",
    render: "static",
    scene: "read",
    validation: "none",
  },
  staticText: {
    check: "none",
    feedback: "none",
    layout: "navigable",
    render: "static",
    scene: "read",
    validation: "none",
  },
  translation: {
    check: "translation",
    feedback: "screen",
    layout: "default",
    render: "translation",
    scene: "choice",
    validation: "translation",
  },
  vocabulary: {
    check: "none",
    feedback: "none",
    layout: "navigable",
    render: "vocabulary",
    scene: "read",
    validation: "none",
  },
};

/**
 * The player has one semantic step descriptor, but multiple subsystems need to
 * ask behavior questions about it: render routing, feedback mode, navigation,
 * client-side checking, and server-side validation. This module keeps those
 * answers in one place so new step kinds become additive instead of scattered.
 */
export function getPlayerStepBehavior(
  descriptor?: PlayerStepDescriptor | null,
): PlayerStepBehavior | null {
  if (!descriptor) {
    return null;
  }

  return STEP_BEHAVIOR_BY_KIND[descriptor.kind];
}

/**
 * Keyboard and shell layout both need to know whether a step participates in
 * left/right static navigation. Deriving that from the shared behavior keeps
 * the layout contract aligned with render routing.
 */
export function hasStaticNavigation(descriptor?: PlayerStepDescriptor | null): boolean {
  return getPlayerStepBehavior(descriptor)?.layout === "navigable";
}

/**
 * Some steps swap to a dedicated feedback screen while others keep feedback
 * inline. The screen model should ask the behavior layer this question rather
 * than re-encoding a list of step kinds.
 */
export function hasFeedbackScreen(descriptor?: PlayerStepDescriptor | null): boolean {
  return getPlayerStepBehavior(descriptor)?.feedback === "screen";
}

/**
 * Groups the player's many step kinds into a smaller set of UI scenes.
 *
 * The shell can reason about a small family of screens: read or choice.
 */
export function getPlayerStepScene(
  descriptor?: PlayerStepDescriptor | null,
): PlayerSceneBehavior | null {
  return getPlayerStepBehavior(descriptor)?.scene ?? null;
}

/**
 * Client-side checking runs against fully typed serialized steps, so it can
 * reuse the canonical descriptor directly and then dispatch to the matching
 * check strategy.
 */
export function getPlayerCheckBehavior(step?: SerializedStep | null): PlayerCheckBehavior | null {
  return getPlayerStepBehavior(describePlayerStep(step))?.check ?? null;
}
