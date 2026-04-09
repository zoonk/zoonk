import { isSupportedStepKind } from "@zoonk/core/steps/contract/content";
import {
  type PlayerStepDescriptor,
  type PlayerStepKind,
  describePlayerStep,
  parsePlayerStepKind,
} from "./player-step";
import { type SerializedStep } from "./prepare-activity-data";

export type PlayerCheckBehavior =
  | "fillBlank"
  | "investigationAction"
  | "investigationCall"
  | "investigationProblem"
  | "listening"
  | "matchColumns"
  | "multipleChoice"
  | "none"
  | "reading"
  | "selectImage"
  | "sortOrder"
  | "story"
  | "translation";

type PlayerFeedbackBehavior = "inline" | "none" | "screen";
type PlayerLayoutBehavior = "default" | "navigable";
type PlayerSceneBehavior = "choice" | "read" | "visual";

export type PlayerRenderBehavior =
  | "fillBlank"
  | "investigation"
  | "listening"
  | "matchColumns"
  | "multipleChoice"
  | "reading"
  | "selectImage"
  | "sortOrder"
  | "static"
  | "story"
  | "translation"
  | "visual"
  | "vocabulary";

export type PlayerValidationBehavior =
  | "fillBlank"
  | "investigationCall"
  | "listening"
  | "matchColumns"
  | "multipleChoice"
  | "none"
  | "reading"
  | "selectImage"
  | "sortOrder"
  | "story"
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
  investigationAction: {
    check: "investigationAction",
    feedback: "inline",
    layout: "default",
    render: "investigation",
    scene: "choice",
    validation: "none",
  },
  investigationCall: {
    check: "investigationCall",
    feedback: "screen",
    layout: "default",
    render: "investigation",
    scene: "choice",
    validation: "investigationCall",
  },
  investigationProblem: {
    check: "investigationProblem",
    feedback: "none",
    layout: "default",
    render: "investigation",
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
  storyDecision: {
    check: "story",
    feedback: "screen",
    layout: "default",
    render: "story",
    scene: "choice",
    validation: "story",
  },
  storyIntro: {
    check: "none",
    feedback: "none",
    layout: "default",
    render: "static",
    scene: "read",
    validation: "none",
  },
  storyOutcome: {
    check: "none",
    feedback: "none",
    layout: "default",
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
  visual: {
    check: "none",
    feedback: "none",
    layout: "navigable",
    render: "visual",
    scene: "visual",
    validation: "none",
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
  descriptor: PlayerStepDescriptor | null | undefined,
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
export function usesStaticNavigation(descriptor: PlayerStepDescriptor | null | undefined): boolean {
  return getPlayerStepBehavior(descriptor)?.layout === "navigable";
}

/**
 * Some steps swap to a dedicated feedback screen while others keep feedback
 * inline. The screen model should ask the behavior layer this question rather
 * than re-encoding a list of step kinds.
 */
export function usesFeedbackScreen(descriptor: PlayerStepDescriptor | null | undefined): boolean {
  return getPlayerStepBehavior(descriptor)?.feedback === "screen";
}

/**
 * Groups the player's many step kinds into a smaller set of UI scenes.
 *
 * Story and investigation still keep their domain-specific step kinds for
 * scoring and validation, but the shell can now reason about a simpler
 * family of screens: read, choice, or visual.
 */
export function getPlayerStepScene(
  descriptor: PlayerStepDescriptor | null | undefined,
): PlayerSceneBehavior | null {
  return getPlayerStepBehavior(descriptor)?.scene ?? null;
}

/**
 * Client-side checking runs against fully typed serialized steps, so it can
 * reuse the canonical descriptor directly and then dispatch to the matching
 * check strategy.
 */
export function getPlayerCheckBehavior(
  step: SerializedStep | null | undefined,
): PlayerCheckBehavior | null {
  return getPlayerStepBehavior(describePlayerStep(step))?.check ?? null;
}

/**
 * Server-side validation only has raw `{ kind, content }` rows. Reusing the
 * canonical parsed step kind keeps validation policy in sync with the client
 * behavior table even when step variants share one physical kind.
 */
export function getPlayerValidationBehavior(step: {
  content: unknown;
  kind: string;
}): PlayerValidationBehavior | null {
  if (!isSupportedStepKind(step.kind)) {
    return null;
  }

  const stepKind = parsePlayerStepKind(step);

  if (!stepKind) {
    return null;
  }

  return STEP_BEHAVIOR_BY_KIND[stepKind].validation;
}
