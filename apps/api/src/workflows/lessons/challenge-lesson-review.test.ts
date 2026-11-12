import { randomUUID } from "node:crypto";
import { draftEmptyScript } from "@zoonk/ai/tasks/challenge/assemble";
import { fixChallengeCase } from "@zoonk/ai/tasks/challenge/fix";
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

async function fieldStep() {
  const { steps } = await playableLessonFixture({
    lesson: {
      spec: { kind: "challenge", skills: [{ description: null, name: "Chance" }], variant: "work" },
    },
    steps: ["challenge"],
  });

  return steps[0]?.id ?? "";
}

const finding = {
  error: "The conclusion cites an unseen result",
  evidence: "The check was skipped",
  location: "report",
  path: "start:skip",
};

const fixedSetting = { find: "Day 3", replace: "Day 4" };

function streamedSteps() {
  return getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`);
}

const DRAFT_STEPS = [
  "writeLesson:started",
  "planChallenge:started",
  "planChallenge:completed",
  "writeChallenge:started",
  "writeChallenge:completed",
  "reviewChallenge:started",
  "reviewChallenge:completed",
];

const FIX_STEPS = [
  "fixChallenge:started",
  "fixChallenge:completed",
  "recheckChallenge:started",
  "recheckChallenge:completed",
];

const READY_STEPS = ["writeLesson:completed", "lessonReady:completed"];

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

  it("publishes the writer's fix once a recheck outside every writer's family passes", async () => {
    const target = await lesson();
    vi.mocked(checkChallengeQuality).mockResolvedValueOnce(taskResult({ findings: [finding] }));

    vi.mocked(fixChallengeCase).mockResolvedValue(
      taskResult({ edits: [fixedSetting] }, "openai/gpt-6.1-terra"),
    );

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateChallengePlan).toHaveBeenCalledOnce();

    expect(fixChallengeCase).toHaveBeenCalledWith(
      expect.objectContaining({ findings: [finding], model: "moonshotai/kimi-k3.1-pro" }),
    );

    expect(vi.mocked(checkChallengeQuality).mock.calls[1]?.[0].writerModels).toStrictEqual([
      "openai/gpt-6.1-sol",
      "moonshotai/kimi-k3.1-pro",
      "openai/gpt-6.1-terra",
    ]);

    const step = await prisma.step.findFirstOrThrow({ where: { lessonId: target.id } });
    expect(step.content).toMatchObject({ setting: "Day 4 at Aurora Shop" });
    expect(streamedSteps()).toStrictEqual([...DRAFT_STEPS, ...FIX_STEPS, ...READY_STEPS]);
  });

  it("writes a fresh draft from the recheck's findings when the fix still has errors", async () => {
    const target = await lesson();
    const recheck = { ...finding, error: "The fixed ending still cites the check" };

    vi.mocked(checkChallengeQuality)
      .mockResolvedValueOnce(taskResult({ findings: [finding] }))
      .mockResolvedValueOnce(taskResult({ findings: [recheck] }));

    vi.mocked(fixChallengeCase).mockResolvedValue(taskResult({ edits: [fixedSetting] }));

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(vi.mocked(generateChallengePlan).mock.calls[1]?.[0].problems).toStrictEqual([
      expect.stringContaining(recheck.error),
    ]);

    expect(streamedSteps()).toStrictEqual([
      ...DRAFT_STEPS,
      ...FIX_STEPS,
      "redraftChallenge:started",
      ...DRAFT_STEPS,
      ...READY_STEPS,
    ]);
  });

  it.each([
    ["names text the case doesn't have", { find: "Day 9", replace: "Day 10" }],
    ["breaks the case's code checks", { find: "1,200", replace: "1,\n200" }],
  ])("writes a fresh draft from the review's findings when the fix %s", async (_label, edit) => {
    const target = await lesson();
    vi.mocked(checkChallengeQuality).mockResolvedValueOnce(taskResult({ findings: [finding] }));
    vi.mocked(fixChallengeCase).mockResolvedValue(taskResult({ edits: [edit] }));

    await expect(lessonContentWorkflow({ lessonId: target.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(checkChallengeQuality).toHaveBeenCalledTimes(2);

    expect(vi.mocked(generateChallengePlan).mock.calls[1]?.[0].problems).toStrictEqual([
      expect.stringContaining(finding.error),
    ]);

    expect(streamedSteps()).toStrictEqual([
      ...DRAFT_STEPS,
      "fixChallenge:started",
      "fixChallenge:completed",
      "redraftChallenge:started",
      ...DRAFT_STEPS,
      ...READY_STEPS,
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

  it("publishes a field draft's fix within the draft's one reservation", async () => {
    const stepId = await fieldStep();
    vi.mocked(checkChallengeQuality).mockResolvedValueOnce(taskResult({ findings: [finding] }));
    vi.mocked(fixChallengeCase).mockResolvedValue(taskResult({ edits: [fixedSetting] }));

    await expect(
      prepareFieldChallenge({
        target: { field: "nursing", ownerId: null, stepId },
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe("ready");

    expect(fixChallengeCase).toHaveBeenCalledOnce();
    expect(checkChallengeQuality).toHaveBeenCalledTimes(2);

    const generation = await prisma.stepVariantGeneration.findFirstOrThrow({ where: { stepId } });
    expect(generation.claimedRunIds).toHaveLength(1);
    expect(generation.heldBackDrafts).toStrictEqual([]);

    const variant = await prisma.stepVariant.findFirstOrThrow({ where: { stepId } });
    expect(variant.content).toMatchObject({ setting: "Day 4 at Aurora Shop" });
  });

  it("holds a field draft its fix couldn't clear for the next preparation, then publishes its replacement", async () => {
    const stepId = await fieldStep();
    const target = { field: "nursing", ownerId: null, stepId };

    vi.mocked(checkChallengeQuality)
      .mockResolvedValueOnce(taskResult({ findings: [finding] }))
      .mockResolvedValueOnce(taskResult({ findings: [finding] }));

    vi.mocked(fixChallengeCase).mockResolvedValue(taskResult({ edits: [fixedSetting] }));

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
    const stepId = await fieldStep();
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
    expect(fixChallengeCase).not.toHaveBeenCalled();
  });
});
