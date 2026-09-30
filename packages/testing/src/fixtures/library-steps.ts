import { randomUUID } from "node:crypto";
import {
  type AnswerExplanation,
  type MediaAsset,
  type Step,
  type StepVariant,
  prisma,
} from "@zoonk/db";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

const DEFAULT_STEP_CONTENT = { text: "Test step content", title: "Test step" };

/**
 * Creates a Library step. Without a position it goes after the lesson's current steps; tests that
 * create several steps in parallel should pass positions.
 */
export async function libraryStepFixture(
  attrs: FixtureAttrs<Step, "content"> & Pick<Step, "lessonId">,
) {
  const position =
    attrs.position ?? (await prisma.step.count({ where: { lessonId: attrs.lessonId } }));

  return prisma.step.create({
    data: {
      content: DEFAULT_STEP_CONTENT,
      kind: "explanation",
      ...fixtureProvenance(),
      ...attrs,
      position,
    },
  });
}

/** Creates a shared "Simpler", "Go deeper", field or tool version of a step. */
export async function stepVariantFixture(
  attrs: FixtureAttrs<StepVariant, "content"> & Pick<StepVariant, "stepId">,
) {
  return prisma.stepVariant.create({
    data: {
      content: { text: "Test simpler step content" },
      kind: "simpler",
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

/** Creates a shared explanation of a wrong answer for an item or a step (pass one of them). */
export async function answerExplanationFixture(
  attrs: FixtureAttrs<AnswerExplanation> & ({ itemId: string } | { stepId: string }),
) {
  return prisma.answerExplanation.create({
    data: {
      explanation: "Test explanation of the mistake",
      language: "en",
      normalizedAnswer: `test answer ${randomUUID()}`,
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

/** Creates an image or audio asset with a unique reuse key. */
export async function mediaAssetFixture(attrs?: FixtureAttrs<MediaAsset, "scene">) {
  const key = randomUUID();

  return prisma.mediaAsset.create({
    data: {
      kind: "image",
      reuseKey: `test-media-${key}`,
      url: `https://example.test/media/${key}.webp`,
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}
