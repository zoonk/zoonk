import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
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

export type PlayerStepDescriptor =
  | StepDescriptorBase<"fillBlank", "fillBlank">
  | StepDescriptorBase<"listening", "listening">
  | StepDescriptorBase<"matchColumns", "matchColumns">
  | StepDescriptorBase<"multipleChoice", "multipleChoice">
  | StepDescriptorBase<"reading", "reading">
  | StepDescriptorBase<"selectImage", "selectImage">
  | StepDescriptorBase<"sortOrder", "sortOrder">
  | StaticGrammarExampleStepDescriptor
  | StaticGrammarRuleStepDescriptor
  | StaticTextStepDescriptor
  | IntroStepDescriptor
  | StepDescriptorBase<"translation", "translation">
  | StepDescriptorBase<"vocabulary", "vocabulary">;

export type PlayerStepKind = PlayerStepDescriptor["kind"];

type PlayerStepImageContent = PlayerStepDescriptor["content"] & {
  image?: StepImage | null;
};

/**
 * Primary step images are attached to content variants, not to player render
 * kinds. Checking the content shape here keeps renderers and preloaders from
 * maintaining separate lists of every step kind that can carry one image.
 */
function hasPlayerStepImageContent(
  content: PlayerStepDescriptor["content"],
): content is PlayerStepImageContent {
  return "image" in content;
}

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

  return { content, kind: "staticText", step };
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

  if (hasStepKind(step, "translation")) {
    return { content: step.content, kind: "translation", step };
  }

  if (hasStepKind(step, "vocabulary")) {
    return { content: step.content, kind: "vocabulary", step };
  }

  return null;
}

/**
 * Returns the one primary image attached directly to a step descriptor.
 *
 * Select-image options store their own image collections. Those stay in their
 * domain helper; this function only answers the shared "does this step have
 * its own main image?" question.
 */
export function getPlayerStepImage(descriptor?: PlayerStepDescriptor | null): StepImage | null {
  if (!descriptor || !hasPlayerStepImageContent(descriptor.content)) {
    return null;
  }

  return descriptor.content.image ?? null;
}
