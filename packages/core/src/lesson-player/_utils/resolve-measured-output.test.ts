import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getActivityAnswerRules } from "../../library/activities/activity-answers";
import { parseStepContent } from "../../library/steps/contract/step-contract";
import { type LessonStepAnswer } from "../contract";
import { type PlayableActivityStep } from "../playable-lesson";
import { resolveMeasuredOutput } from "./resolve-measured-output";

function codeStep(language: "java" | "javascript"): PlayableActivityStep {
  const content = parseStepContent("activity", {
    check: { explanation: "The program prints hello.", kind: "interaction" },
    fields: {
      editableLines: [1],
      expectedOutput: "hello",
      language,
      mistakes: [],
      solution: "solution",
      starterCode: "starter",
    },
    prompt: "Print hello.",
    template: "codeRunner",
  });

  return {
    ...getActivityAnswerRules(content),
    citation: null,
    content,
    id: randomUUID(),
    image: null,
    imagePending: false,
    kind: "activity",
    marks: null,
    position: 0,
    skillId: null,
  };
}

function output(runId?: string): LessonStepAnswer {
  return { answer: { kind: "output", output: "client's output", runId }, kind: "activity" };
}

describe(resolveMeasuredOutput, () => {
  it("uses recorded stdout even if the client submits a different string", async () => {
    const user = await userFixture();
    const step = codeStep("java");
    const id = randomUUID();

    await prisma.codeRun.create({
      data: {
        finishedAt: new Date(),
        id,
        language: "java",
        output: "measured output",
        requestId: randomUUID(),
        sandboxName: `run-${id}`,
        startedAt: new Date(),
        stop: "timeout",
        userId: user.id,
      },
    });

    await expect(
      resolveMeasuredOutput({ answer: output(id), step, userId: user.id }),
    ).resolves.toStrictEqual({
      answer: { kind: "output", output: "measured output", runId: id },
      kind: "activity",
    });
  });

  it.each([
    { case: "another owner", finished: true, language: "java", owned: false, stop: "done" },
    { case: "another language", finished: true, language: "cpp", owned: true, stop: "done" },
    { case: "an active run", finished: false, language: "java", owned: true, stop: null },
    {
      case: "an unavailable run",
      finished: true,
      language: "java",
      owned: true,
      stop: "unavailable",
    },
  ] as const)("rejects $case", async ({ finished, language, owned, stop }) => {
    const [viewer, differentOwner] = await Promise.all([userFixture(), userFixture()]);
    const id = randomUUID();

    await prisma.codeRun.create({
      data: {
        finishedAt: finished ? new Date() : null,
        id,
        language,
        output: "hello",
        requestId: randomUUID(),
        sandboxName: `run-${id}`,
        startedAt: new Date(),
        stop,
        userId: owned ? viewer.id : differentOwner.id,
      },
    });

    await expect(
      resolveMeasuredOutput({ answer: output(id), step: codeStep("java"), userId: viewer.id }),
    ).resolves.toBeNull();
  });

  it("rejects missing sandbox IDs and keeps device answers", async () => {
    const userId = randomUUID();
    const step = codeStep("java");

    await expect(resolveMeasuredOutput({ answer: output(), step, userId })).resolves.toBeNull();

    await expect(
      resolveMeasuredOutput({ answer: output(randomUUID()), step, userId }),
    ).resolves.toBeNull();

    await expect(
      resolveMeasuredOutput({ answer: output(), step: codeStep("javascript"), userId }),
    ).resolves.toStrictEqual(output());
  });
});
