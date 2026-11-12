import { randomUUID } from "node:crypto";
import { draftEmptyScript } from "@zoonk/ai/tasks/challenge/assemble";
import { generateChallengePlan } from "@zoonk/ai/tasks/challenge/plan";
import { challengePlanFixture } from "@zoonk/ai/tasks/challenge/plan-fixture";
import { generateChallengeScript } from "@zoonk/ai/tasks/challenge/script";
import { checkChallengeQuality } from "@zoonk/ai/tasks/quality/challenge-quality-check";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStreamedEvents } from "../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { prepareFieldChallenge } from "../sessions/prepare-field-challenge";
import { lessonContentWorkflow } from "./lesson-content-workflow";

async function lesson(ownerId?: string) {
  const chapter = await libraryChapterFixture();

  return libraryLessonFixture({
    homeChapterId: chapter.id,
    ownerId,
    spec: { kind: "challenge", skills: [{ description: null, name: "Chance" }], variant: "work" },
    specStatus: "completed",
  });
}

const finding = {
  error: "The conclusion cites an unseen result",
  evidence: "The check was skipped",
  location: "report",
  path: "start:skip",
};

describe("challenge prepublication review", () => {
  beforeEach(() => {
    vi.mocked(generateChallengePlan).mockResolvedValue(
      taskResult(challengePlanFixture(), "openai/gpt-6.1-sol"),
    );

    vi.mocked(generateChallengeScript).mockResolvedValue(
      taskResult(draftEmptyScript(challengePlanFixture()), "moonshotai/kimi-k3.1-pro"),
    );

    vi.mocked(checkChallengeQuality).mockResolvedValue(taskResult({ findings: [] }));
  });

  it("publishes only after plan, script and whole-case review", async () => {
    const target = await lesson();

    vi.mocked(checkChallengeQuality).mockImplementation(async (params) => {
      await expect(prisma.step.count({ where: { lessonId: target.id } })).resolves.toBe(0);
      expect(params.writerModels).toStrictEqual(["openai/gpt-6.1-sol", "moonshotai/kimi-k3.1-pro"]);
      expect(params.renderedCase).toContain("# Paths");
      expect(params).not.toHaveProperty("plan");
      return taskResult({ findings: [] });
    });

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(prisma.step.count({ where: { lessonId: target.id } })).resolves.toBe(1);
  });

  it("skips scripting for a failed plan and sets aside after three drafts", async () => {
    const target = await lesson();

    vi.mocked(generateChallengePlan).mockResolvedValue(
      taskResult({ ...challengePlanFixture(), startDecisionId: "missing" }),
    );

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "heldBack",
    });

    expect(generateChallengeScript).not.toHaveBeenCalled();
    expect(checkChallengeQuality).not.toHaveBeenCalled();
    const saved = await prisma.lesson.findUniqueOrThrow({ where: { id: target.id } });
    expect(saved.heldBackDrafts).toHaveLength(3);
    expect(saved.setAsideAt).not.toBeNull();
  });

  it("skips review when script assembly fails", async () => {
    const target = await lesson();

    vi.mocked(generateChallengeScript).mockResolvedValue(
      taskResult({ ...draftEmptyScript(challengePlanFixture()), decisions: [] }),
    );

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "heldBack",
    });

    expect(checkChallengeQuality).not.toHaveBeenCalled();
  });

  it("gives the next plan every earlier review problem", async () => {
    const target = await lesson();
    vi.mocked(checkChallengeQuality).mockResolvedValueOnce(taskResult({ findings: [finding] }));

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(vi.mocked(generateChallengePlan).mock.calls[1]?.[0].problems?.[0]).toContain(
      finding.error,
    );

    expect(vi.mocked(generateChallengePlan).mock.calls[1]?.[0].problems).toStrictEqual([
      expect.stringContaining(finding.error),
    ]);
  });

  it("keeps its wait on the redraft until the next draft is published", async () => {
    const target = await lesson();
    vi.mocked(checkChallengeQuality).mockResolvedValueOnce(taskResult({ findings: [finding] }));

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(
      getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`),
    ).toStrictEqual([
      "writeLesson:started",
      "planChallenge:started",
      "planChallenge:completed",
      "writeChallenge:started",
      "writeChallenge:completed",
      "reviewChallenge:started",
      "reviewChallenge:completed",
      "redraftChallenge:started",
      "writeLesson:started",
      "planChallenge:started",
      "planChallenge:completed",
      "writeChallenge:started",
      "writeChallenge:completed",
      "reviewChallenge:started",
      "reviewChallenge:completed",
      "writeLesson:completed",
      "lessonReady:completed",
    ]);
  });

  it("fails closed on reviewer outage without recording a content rejection", async () => {
    const target = await lesson();
    vi.mocked(checkChallengeQuality).mockRejectedValue(new Error("Reviewer unavailable"));

    await expect(lessonContentWorkflow({ lessonId: target.id })).rejects.toThrow(
      "Reviewer unavailable",
    );

    await expect(prisma.step.count({ where: { lessonId: target.id } })).resolves.toBe(0);

    const saved = await prisma.lesson.findUniqueOrThrow({ where: { id: target.id } });
    expect(saved.heldBackDrafts).toStrictEqual([]);
  });

  it("reviews a field draft, holds it for the next preparation, then publishes its replacement", async () => {
    const { steps } = await playableLessonFixture({
      lesson: {
        spec: {
          kind: "challenge",
          skills: [{ description: null, name: "Chance" }],
          variant: "work",
        },
      },
      steps: ["challenge"],
    });

    const stepId = steps[0]?.id ?? "";
    const target = { field: "nursing", ownerId: null, stepId };
    vi.mocked(checkChallengeQuality).mockResolvedValueOnce(taskResult({ findings: [finding] }));

    await expect(prepareFieldChallenge({ target, workflowRunId: randomUUID() })).resolves.toBe(
      "heldBack",
    );

    expect(generateChallengePlan).toHaveBeenCalledOnce();

    await expect(prepareFieldChallenge({ target, workflowRunId: randomUUID() })).resolves.toBe(
      "ready",
    );

    expect(vi.mocked(generateChallengePlan).mock.calls[1]?.[0].problems).toStrictEqual([
      expect.stringContaining(finding.error),
    ]);

    const generation = await prisma.stepVariantGeneration.findFirstOrThrow({ where: { stepId } });

    expect(generation.claimedRunIds).toHaveLength(2);
    expect(generation.heldBackDrafts).toHaveLength(1);
    await expect(prisma.stepVariant.count({ where: { stepId } })).resolves.toBe(1);
  });

  it("spends a field reservation but records no content rejection when the reviewer is unavailable", async () => {
    const { steps } = await playableLessonFixture({
      lesson: {
        spec: {
          kind: "challenge",
          skills: [{ description: null, name: "Chance" }],
          variant: "work",
        },
      },
      steps: ["challenge"],
    });

    const stepId = steps[0]?.id ?? "";
    vi.mocked(checkChallengeQuality).mockRejectedValue(new Error("Review unavailable"));

    await expect(
      prepareFieldChallenge({
        target: { field: "nursing", ownerId: null, stepId },
        workflowRunId: randomUUID(),
      }),
    ).rejects.toThrow("Review unavailable");

    const generation = await prisma.stepVariantGeneration.findFirstOrThrow({ where: { stepId } });

    expect(generation.claimedRunIds).toHaveLength(1);
    expect(generation.heldBackDrafts).toStrictEqual([]);
    await expect(prisma.stepVariant.count({ where: { stepId } })).resolves.toBe(0);
  });

  it("uses the private scope model on both calls without a reviewer", async () => {
    const owner = await userFixture();
    const target = await lesson(owner.id);

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateChallengePlan).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-6-luna" }),
    );

    expect(generateChallengeScript).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-6-luna" }),
    );

    expect(checkChallengeQuality).not.toHaveBeenCalled();
  });
});
