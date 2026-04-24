import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { type StepImage } from "@zoonk/core/steps/contract/image";

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

type IntroStepContent = Extract<SerializedStep<"static">["content"], { variant: "intro" }>;

type IntroStepDescriptor = StepDescriptorBase<"static", "intro"> & {
  content: IntroStepContent;
  intro: {
    image?: StepImage | null;
    text: string;
    title: string;
  };
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
  | IntroStepDescriptor
  | StoryOutcomeStepDescriptor
  | StepDescriptorBase<"translation", "translation">
  | StepDescriptorBase<"vocabulary", "vocabulary">;

export type PlayerStepKind = PlayerStepDescriptor["kind"];

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

function describeStaticStep(step: SerializedStep<"static">): PlayerStepDescriptor {
  const content = step.content;

  if (content.variant === "intro") {
    return {
      content,
      intro: { image: content.image, text: content.text, title: content.title },
      kind: "intro",
      step,
    };
  }

  if (content.variant === "grammarExample") {
    return { content, kind: "staticGrammarExample", step };
  }

  if (content.variant === "grammarRule") {
    return { content, kind: "staticGrammarRule", step };
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
export function describePlayerStep(step?: SerializedStep | null): PlayerStepDescriptor | null {
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

  if (hasStepKind(step, "vocabulary")) {
    return { content: step.content, kind: "vocabulary", step };
  }

  return null;
}

/**
 * Investigation variants drive special reducer transitions and button
 * labeling. This helper exposes the current investigation phase without making
 * each caller know how investigation content is shaped.
 */
export function getInvestigationVariant(
  step?: SerializedStep | null,
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
