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

/** Tests that create several steps in parallel should pass positions. */
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

export async function stepVariantFixture(
  attrs: FixtureAttrs<StepVariant, "content"> & Pick<StepVariant, "stepId">,
) {
  return prisma.stepVariant.create({
    data: {
      content: { text: "Test step content for nurses" },
      key: "nursing",
      kind: "field",
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

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
