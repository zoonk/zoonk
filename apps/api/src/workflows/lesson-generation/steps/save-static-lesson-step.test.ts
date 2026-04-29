import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, test } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveExplanationLessonStep } from "./save-static-lesson-step";

describe(saveExplanationLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  test("saves static explanation steps with generated images", async () => {
    const context = await createLessonContext({ kind: "explanation", organizationId });
    await stepFixture({
      content: { text: "stale", title: "Stale", variant: "text" },
      kind: "static",
      lessonId: context.id,
    });

    const stepsToSave = [
      { text: `Why does this happen? ${randomUUID()}`, title: "Question" },
      { text: `Each layer adds a different label. ${randomUUID()}`, title: "Layers" },
    ];
    const images = [
      {
        prompt: "A packet with labels added around it.",
        url: "https://example.com/packet.webp",
      },
      {
        prompt: "Each layer adding a label.",
        url: "https://example.com/labels.webp",
      },
    ];

    await saveExplanationLessonStep({ context, images, steps: stepsToSave });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "static"],
    ]);
    expect(steps[0]?.content).toEqual({
      image: images[0],
      text: stepsToSave[0]?.text,
      title: "Question",
      variant: "text",
    });
    expect(steps[1]?.content).toEqual({
      image: images[1],
      text: stepsToSave[1]?.text,
      title: "Layers",
      variant: "text",
    });
    expect(getStreamedEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "started", step: "saveExplanationLesson" }),
        expect.objectContaining({ status: "completed", step: "saveExplanationLesson" }),
      ]),
    );
  });
});
