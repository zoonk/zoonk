import { randomUUID } from "node:crypto";
import { generateCourseDiscovery } from "@zoonk/ai/tasks/courses/discovery";
import { resolveLearningRequest as classifyLearningRequest } from "@zoonk/ai/tasks/courses/request";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import {
  answerCurrentUserCourseDiscovery,
  createCurrentUserCourseDiscovery,
  getCurrentUserCourseDiscovery,
  retryCurrentUserCourseDiscovery,
  reviseCurrentUserCourseDiscovery,
  startCurrentUserCourseDiscovery,
} from "./discovery";
import { resolveLearningRequest } from "./learning-request";
import { getCurrentUserTrack, startCurrentUserTrack, updateCurrentUserTrack } from "./tracks";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@zoonk/ai/tasks/courses/discovery", () => ({ generateCourseDiscovery: vi.fn() }));
vi.mock("@zoonk/ai/tasks/courses/request", () => ({ resolveLearningRequest: vi.fn() }));

const readyBrief = {
  description: "My unusual constraints",
  learningGoal: "Build a useful prototype",
  requirements: ["An unusual local constraint"],
  startingKnowledge: "Some basics",
  title: "A personal learning plan",
};

const ready = {
  brief: readyBrief,
  format: "personalized" as const,
  question: null,
  reusableCoursePrompt: null,
  status: "ready" as const,
  targetLanguage: null,
};

const ask = {
  brief: null,
  format: null,
  question: {
    description: "Choose the useful outcome",
    id: "outcome",
    optional: false,
    options: [
      { description: "Make a small working version", id: "prototype", label: "A prototype" },
    ],
    question: "What would you like to make?",
  },
  reusableCoursePrompt: null,
  status: "ask" as const,
  targetLanguage: null,
};

async function learner() {
  const user = await userFixture();
  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
  return user;
}

describe("private learning requests", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue(new Headers());
    vi.mocked(generateCourseDiscovery, { partial: true }).mockResolvedValue({ data: ready });

    vi.mocked(classifyLearningRequest, { partial: true }).mockResolvedValue({
      data: { intent: "learn", subjects: [], trackTitle: null },
    });
  });

  it("does not send a guest's private request to AI or public prompt persistence", async () => {
    const prompt = `Private situation ${randomUUID()}`;

    await expect(resolveLearningRequest({ language: "en", prompt })).resolves.toStrictEqual({
      kind: "unauthorized",
    });

    expect(classifyLearningRequest).not.toHaveBeenCalled();
    await expect(prisma.coursePrompt.count({ where: { prompt } })).resolves.toBe(0);
  });

  it("saves one answer under concurrency, clears the finished question, and protects owner visibility", async () => {
    await learner();
    vi.mocked(generateCourseDiscovery, { partial: true }).mockResolvedValueOnce({ data: ask });

    const created = await createCurrentUserCourseDiscovery({
      language: "en",
      prompt: `Private request ${randomUUID()}`,
    });

    expect(created.status).toBe("ready");

    if (created.status !== "ready") {
      return;
    }

    const answer = {
      discoveryId: created.discovery.id,
      expectedRevision: 1,
      optionId: "prototype",
      questionId: "outcome",
    };

    const outcomes = await Promise.all([
      answerCurrentUserCourseDiscovery(answer),
      answerCurrentUserCourseDiscovery(answer),
    ]);

    expect(outcomes.map((outcome) => outcome.status).toSorted()).toStrictEqual([
      "conflict",
      "ready",
    ]);

    const resource = await getCurrentUserCourseDiscovery({ discoveryId: created.discovery.id });

    expect(resource).toMatchObject({
      discovery: {
        answers: [{ answer: "A prototype", questionId: "outcome" }],
        question: null,
        revision: 2,
        status: "ready",
      },
      status: "ready",
    });

    await learner();

    await expect(
      getCurrentUserCourseDiscovery({ discoveryId: created.discovery.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("recovers expired pending work with a new revision and rejects still-active retries", async () => {
    const user = await learner();

    const record = await prisma.courseDiscovery.create({
      data: {
        language: "en",
        prompt: `Interrupted ${randomUUID()}`,
        status: "pending",
        updatedAt: new Date(Date.now() - 181_000),
        userId: user.id,
      },
    });

    await expect(getCurrentUserCourseDiscovery({ discoveryId: record.id })).resolves.toMatchObject({
      discovery: { status: "failed" },
    });

    await expect(
      retryCurrentUserCourseDiscovery({ discoveryId: record.id }),
    ).resolves.toMatchObject({ discovery: { revision: 2, status: "ready" }, status: "ready" });

    const active = await prisma.courseDiscovery.create({
      data: { language: "en", prompt: "Still active", status: "pending", userId: user.id },
    });

    await expect(
      retryCurrentUserCourseDiscovery({ discoveryId: active.id }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("revises a trusted earlier answer and discards later dependent details", async () => {
    const user = await learner();

    const record = await prisma.courseDiscovery.create({
      data: {
        answers: [
          { answer: "Old outcome", question: "Which outcome?", questionId: "goal" },
          { answer: "Old dependent detail", question: "Which detail?", questionId: "detail" },
        ],
        language: "en",
        prompt: "My goal",
        status: "ready",
        userId: user.id,
      },
    });

    await expect(
      reviseCurrentUserCourseDiscovery({
        answerIndex: 0,
        answerText: "A different outcome",
        discoveryId: record.id,
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({
      discovery: {
        answers: [
          { answer: "A different outcome", question: "Which outcome?", questionId: "goal" },
        ],
        revision: 2,
      },
      status: "ready",
    });

    expect(generateCourseDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: [
          { answer: "A different outcome", question: "Which outcome?", questionId: "goal" },
        ],
      }),
    );

    await expect(
      reviseCurrentUserCourseDiscovery({
        answerIndex: 0,
        answerText: "Stale change",
        discoveryId: record.id,
        expectedRevision: 1,
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("rechecks the completed private brief and blocks newly unsafe scope", async () => {
    const user = await learner();

    const created = await createCurrentUserCourseDiscovery({
      language: "en",
      prompt: `Private request ${randomUUID()}`,
    });

    if (created.status !== "ready") {
      throw new Error("Expected discovery");
    }

    vi.mocked(classifyLearningRequest, { partial: true }).mockResolvedValue({
      data: { intent: "unsafe", subjects: [], trackTitle: null },
    });

    await expect(
      startCurrentUserCourseDiscovery({ discoveryId: created.discovery.id, expectedRevision: 1 }),
    ).resolves.toStrictEqual({ status: "unsafe" });

    await expect(prisma.course.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("creates one private curriculum shell across concurrent starts and never a shared prompt", async () => {
    const user = await learner();
    const prompt = `Private request ${randomUUID()}`;
    const created = await createCurrentUserCourseDiscovery({ language: "en", prompt });

    if (created.status !== "ready") {
      throw new Error("Expected discovery");
    }

    const outcomes = await Promise.all([
      startCurrentUserCourseDiscovery({ discoveryId: created.discovery.id, expectedRevision: 1 }),
      startCurrentUserCourseDiscovery({ discoveryId: created.discovery.id, expectedRevision: 1 }),
    ]);

    expect(outcomes.every((outcome) => outcome.status === "generationRequired")).toBe(true);

    await expect(
      prisma.course.count({
        where: { format: "personalized", organizationId: null, userId: user.id },
      }),
    ).resolves.toBe(1);

    await expect(prisma.coursePrompt.count({ where: { prompt } })).resolves.toBe(0);
  });

  it("limits daily request work independently of chapter allowance", async () => {
    const user = await learner();
    const now = new Date();

    await prisma.generationQuotaCounter.create({
      data: {
        actorKey: `user:${user.id}`,
        count: 100,
        period: "day",
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        resource: "learningRequest",
      },
    });

    await expect(
      resolveLearningRequest({ language: "en", prompt: `Subject ${randomUUID()}` }),
    ).resolves.toMatchObject({
      kind: "limitReached",
      limit: { period: "day", resource: "learningRequest" },
    });

    expect(classifyLearningRequest).not.toHaveBeenCalled();

    await expect(prisma.chapterGenerationGrant.count({ where: { userId: user.id } })).resolves.toBe(
      0,
    );
  });

  it("keeps distinct subjects in one retry-stable Track with ordered unresolved generation", async () => {
    await learner();
    const token = randomUUID();

    vi.mocked(classifyLearningRequest, { partial: true }).mockResolvedValue({
      data: {
        intent: "learn",
        subjects: ["Robotics", "Electronics"].map((title) => ({
          format: "core",
          prompt: title,
          requiresDiscovery: false,
          targetLanguage: null,
          title: `${title} ${token}`,
        })),
        trackTitle: "A combined goal",
      },
    });

    const input = { language: "en", prompt: `My combined goal ${token}` };
    const first = await resolveLearningRequest(input);
    expect(first.kind).toBe("track");

    if (first.kind !== "track") {
      return;
    }

    await expect(resolveLearningRequest(input)).resolves.toStrictEqual(first);
    const track = await getCurrentUserTrack({ trackId: first.trackId });

    expect(track).toMatchObject({
      status: "ready",
      track: {
        nextTarget: null,
        pendingCourses: [{ position: 0 }, { position: 1 }],
        progress: { totalCourses: 2 },
      },
    });

    if (track.status !== "ready") {
      throw new Error("Expected Track");
    }

    const [firstPending, secondPending] = track.track.pendingCourses;

    if (!firstPending || !secondPending) {
      throw new Error("Expected two pending courses");
    }

    await expect(
      updateCurrentUserTrack({
        input: {
          members: [
            { coursePromptId: secondPending.coursePromptId },
            { coursePromptId: firstPending.coursePromptId },
          ],
        },
        trackId: first.trackId,
      }),
    ).resolves.toMatchObject({
      status: "ready",
      track: {
        pendingCourses: [
          { coursePromptId: secondPending.coursePromptId, position: 0 },
          { coursePromptId: firstPending.coursePromptId, position: 1 },
        ],
      },
    });

    await expect(startCurrentUserTrack({ trackId: first.trackId })).resolves.toMatchObject({
      resource: "coursePrompt",
      resourceId: secondPending.coursePromptId,
      status: "generationRequired",
    });

    await expect(
      updateCurrentUserTrack({
        input: { members: [{ coursePromptId: firstPending.coursePromptId }] },
        trackId: first.trackId,
      }),
    ).resolves.toMatchObject({ status: "ready", track: { progress: { totalCourses: 1 } } });

    await expect(startCurrentUserTrack({ trackId: first.trackId })).resolves.toMatchObject({
      resourceId: firstPending.coursePromptId,
      status: "generationRequired",
    });

    await expect(
      updateCurrentUserTrack({
        input: { members: [{ coursePromptId: randomUUID() }] },
        trackId: first.trackId,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
