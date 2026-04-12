import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import {
  type InvestigationStepContent,
  type StoryStaticVariant,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";

type StepDescriptorBase<Kind extends SerializedStep["kind"], Name extends string> = {
  content: SerializedStep<Kind>["content"];
  kind: Name;
  step: SerializedStep<Kind>;
};

type StaticTextStepDescriptor = StepDescriptorBase<"static", "staticText"> & {
  content: Extract<SerializedStep<"static">["content"], { variant: "text" }>;
};

type StaticGrammarExampleStepDescriptor = StepDescriptorBase<"static", "staticGrammarExample"> & {
  content: Extract<SerializedStep<"static">["content"], { variant: "grammarExample" }>;
};

type StaticGrammarRuleStepDescriptor = StepDescriptorBase<"static", "staticGrammarRule"> & {
  content: Extract<SerializedStep<"static">["content"], { variant: "grammarRule" }>;
};

type StoryIntroStepDescriptor = StepDescriptorBase<"static", "storyIntro"> & {
  content: Extract<SerializedStep<"static">["content"], { variant: "storyIntro" }>;
};

type StoryOutcomeStepDescriptor = StepDescriptorBase<"static", "storyOutcome"> & {
  content: Extract<SerializedStep<"static">["content"], { variant: "storyOutcome" }>;
};

type InvestigationProblemStepDescriptor = StepDescriptorBase<
  "investigation",
  "investigationProblem"
> & {
  content: Extract<SerializedStep<"investigation">["content"], { variant: "problem" }>;
};

type InvestigationActionStepDescriptor = StepDescriptorBase<
  "investigation",
  "investigationAction"
> & {
  content: Extract<SerializedStep<"investigation">["content"], { variant: "action" }>;
};

type InvestigationCallStepDescriptor = StepDescriptorBase<"investigation", "investigationCall"> & {
  content: Extract<SerializedStep<"investigation">["content"], { variant: "call" }>;
};

export type PlayerStepDescriptor =
  | StepDescriptorBase<"fillBlank", "fillBlank">
  | InvestigationActionStepDescriptor
  | InvestigationCallStepDescriptor
  | InvestigationProblemStepDescriptor
  | StepDescriptorBase<"listening", "listening">
  | StepDescriptorBase<"matchColumns", "matchColumns">
  | StepDescriptorBase<"multipleChoice", "multipleChoice">
  | StepDescriptorBase<"reading", "reading">
  | StepDescriptorBase<"selectImage", "selectImage">
  | StepDescriptorBase<"sortOrder", "sortOrder">
  | StaticGrammarExampleStepDescriptor
  | StaticGrammarRuleStepDescriptor
  | StaticTextStepDescriptor
  | StepDescriptorBase<"story", "storyDecision">
  | StoryIntroStepDescriptor
  | StoryOutcomeStepDescriptor
  | StepDescriptorBase<"translation", "translation">
  | StepDescriptorBase<"visual", "visual">
  | StepDescriptorBase<"vocabulary", "vocabulary">;

export type PlayerStepKind = PlayerStepDescriptor["kind"];

const IDENTITY_PLAYER_STEP_KINDS = [
  "fillBlank",
  "listening",
  "matchColumns",
  "multipleChoice",
  "reading",
  "selectImage",
  "sortOrder",
  "translation",
  "visual",
  "vocabulary",
] as const satisfies readonly PlayerStepKind[];

const IDENTITY_PLAYER_STEP_KIND_SET: ReadonlySet<string> = new Set(IDENTITY_PLAYER_STEP_KINDS);

type IdentityPlayerStepKind = (typeof IDENTITY_PLAYER_STEP_KINDS)[number];

/**
 * `SerializedStep` loses some of its `kind` to `content` correlation once it
 * moves through arrays and reducer state. This guard restores that link so the
 * descriptor layer can narrow safely without unsafe assertions.
 */
function hasStepKind<Kind extends SerializedStep["kind"]>(
  step: SerializedStep,
  kind: Kind,
): step is SerializedStep<Kind> {
  return step.kind === kind;
}

/**
 * Static steps share the same physical kind, but they behave differently
 * depending on their content variant. This helper names those variants once
 * so the rest of the player can switch on a canonical descriptor instead of
 * repeating `step.kind` plus `content.variant` checks.
 */
function getStaticStepKind(content: SerializedStep<"static">["content"]): PlayerStepKind {
  switch (content.variant) {
    case "grammarExample":
      return "staticGrammarExample";
    case "grammarRule":
      return "staticGrammarRule";
    case "storyIntro":
      return "storyIntro";
    case "storyOutcome":
      return "storyOutcome";
    case "text":
      return "staticText";
    default:
      return "staticText";
  }
}

/**
 * Investigation steps also share one physical kind while representing three
 * distinct phases of the investigation flow. A canonical descriptor lets the
 * reducer, shell, and renderers talk about those phases with one vocabulary.
 */
function getInvestigationStepKind(
  content: SerializedStep<"investigation">["content"],
): PlayerStepKind {
  switch (content.variant) {
    case "action":
      return "investigationAction";
    case "call":
      return "investigationCall";
    case "problem":
      return "investigationProblem";
    default:
      return "investigationProblem";
  }
}

/**
 * Most raw server step kinds already match the canonical player step kind.
 * This helper isolates that identity mapping so parsePlayerStepKind only
 * needs to special-case the variants that truly diverge (`static`,
 * `investigation`, and `story`).
 */
function isIdentityPlayerStepKind(kind: string): kind is IdentityPlayerStepKind {
  return IDENTITY_PLAYER_STEP_KIND_SET.has(kind);
}

function describeStaticStep(step: SerializedStep<"static">): PlayerStepDescriptor {
  const content = step.content;

  if (content.variant === "grammarExample") {
    return { content, kind: "staticGrammarExample", step };
  }

  if (content.variant === "grammarRule") {
    return { content, kind: "staticGrammarRule", step };
  }

  if (content.variant === "storyIntro") {
    return { content, kind: "storyIntro", step };
  }

  if (content.variant === "storyOutcome") {
    return { content, kind: "storyOutcome", step };
  }

  return { content, kind: "staticText", step };
}

function describeInvestigationStep(step: SerializedStep<"investigation">): PlayerStepDescriptor {
  const content = step.content;

  if (content.variant === "action") {
    return { content, kind: "investigationAction", step };
  }

  if (content.variant === "call") {
    return { content, kind: "investigationCall", step };
  }

  return { content, kind: "investigationProblem", step };
}

/**
 * Returns the canonical player step descriptor for a serialized step.
 *
 * This exists so the player package can classify steps once and reuse that
 * meaning everywhere else, instead of rebuilding the same `kind` and `variant`
 * decisions in each UI and reducer file.
 */
export function describePlayerStep(
  step: SerializedStep | null | undefined,
): PlayerStepDescriptor | null {
  if (!step) {
    return null;
  }

  if (hasStepKind(step, "fillBlank")) {
    return { content: step.content, kind: "fillBlank", step };
  }

  if (hasStepKind(step, "investigation")) {
    return describeInvestigationStep(step);
  }

  if (hasStepKind(step, "listening")) {
    return { content: step.content, kind: "listening", step };
  }

  if (hasStepKind(step, "matchColumns")) {
    return { content: step.content, kind: "matchColumns", step };
  }

  if (hasStepKind(step, "multipleChoice")) {
    return { content: step.content, kind: "multipleChoice", step };
  }

  if (hasStepKind(step, "reading")) {
    return { content: step.content, kind: "reading", step };
  }

  if (hasStepKind(step, "selectImage")) {
    return { content: step.content, kind: "selectImage", step };
  }

  if (hasStepKind(step, "sortOrder")) {
    return { content: step.content, kind: "sortOrder", step };
  }

  if (hasStepKind(step, "static")) {
    return describeStaticStep(step);
  }

  if (hasStepKind(step, "story")) {
    return { content: step.content, kind: "storyDecision", step };
  }

  if (hasStepKind(step, "translation")) {
    return { content: step.content, kind: "translation", step };
  }

  if (hasStepKind(step, "visual")) {
    return { content: step.content, kind: "visual", step };
  }

  if (hasStepKind(step, "vocabulary")) {
    return { content: step.content, kind: "vocabulary", step };
  }

  return null;
}

/**
 * Story intro and outcome screens are the only static variants that replace
 * side-navigation with a primary action button. Keeping that distinction here
 * prevents the rest of the package from repeating story-specific checks.
 */
export function getStoryStaticVariant(
  step: SerializedStep | null | undefined,
): StoryStaticVariant | null {
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind === "storyIntro") {
    return "storyIntro";
  }

  if (descriptor?.kind === "storyOutcome") {
    return "storyOutcome";
  }

  return null;
}

/**
 * Investigation variants drive special reducer transitions, sticky-header
 * recall, and button labeling. This helper exposes the current investigation
 * phase without making each caller know how investigation content is shaped.
 */
export function getInvestigationVariant(
  step: SerializedStep | null | undefined,
): InvestigationStepContent["variant"] | null {
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind === "investigationAction") {
    return "action";
  }

  if (descriptor?.kind === "investigationCall") {
    return "call";
  }

  if (descriptor?.kind === "investigationProblem") {
    return "problem";
  }

  return null;
}
