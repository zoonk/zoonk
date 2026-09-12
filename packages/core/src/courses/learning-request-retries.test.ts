import { randomUUID } from "node:crypto";
import { resolveLearningRequest as classifyLearningRequest } from "@zoonk/ai/tasks/courses/request";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { startCurrentUserCourseDiscovery } from "./discovery";
import { resolveLearningRequest } from "./learning-request";
import { getCurrentUserTrack, startCurrentUserTrack } from "./tracks";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("@zoonk/ai/tasks/courses/request", () => ({ resolveLearningRequest: vi.fn() }));

describe("learning request retry boundaries", () => {
  it("uses the final public subject identity instead of a discovery instruction or private prompt", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    const title = `Software testing ${randomUUID()}`;

    const brief = {
      description: "A private work goal",
      learningGoal: "Verify software at my employer",
      requirements: ["Confidential project"],
      startingKnowledge: "Some coding",
      title: "My private project",
    };

    const discovery = await prisma.courseDiscovery.create({
      data: {
        language: "en",
        prompt: "Confidential employer-specific text",
        resolution: {
          brief,
          format: "core",
          question: null,
          reusableCoursePrompt:
            "Teach a practical course and include a long syllabus, never use this instruction as the course name",
          status: "ready",
          targetLanguage: null,
        },
        status: "ready",
        userId: user.id,
      },
    });

    vi.mocked(classifyLearningRequest, { partial: true }).mockResolvedValue({
      data: {
        intent: "learn",
        subjects: [
          {
            format: "core",
            prompt: "Private details from the original input",
            requiresDiscovery: true,
            targetLanguage: null,
            title,
          },
        ],
        trackTitle: null,
      },
    });

    const result = await startCurrentUserCourseDiscovery({
      discoveryId: discovery.id,
      expectedRevision: 1,
    });

    expect(result).toMatchObject({ resource: "coursePrompt", status: "generationRequired" });

    if (result.status !== "generationRequired" || result.resource !== "coursePrompt") {
      throw new Error("Expected reusable course prompt");
    }

    await expect(
      prisma.coursePrompt.findUnique({ where: { id: result.resourceId } }),
    ).resolves.toMatchObject({ canonicalTitle: title, prompt: title });

    await expect(prisma.course.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("shows one course when distinct subject aliases resolve to the same reusable language", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    const organization = await aiOrganizationFixture();
    const language = `x-${randomUUID().slice(0, 6)}`;

    const course = await courseFixture({
      format: "language",
      generationStatus: "completed",
      isPublished: true,
      language,
      organizationId: organization.id,
      targetLanguage: "en",
    });

    vi.mocked(classifyLearningRequest, { partial: true }).mockResolvedValue({
      data: {
        intent: "learn",
        subjects: ["English", "English language"].map((title) => ({
          format: "language",
          prompt: title,
          requiresDiscovery: false,
          targetLanguage: "en",
          title,
        })),
        trackTitle: "English",
      },
    });

    await expect(
      resolveLearningRequest({ language, prompt: `English and English language ${randomUUID()}` }),
    ).resolves.toMatchObject({ course: { id: course.id }, kind: "course" });

    await expect(prisma.track.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("collapses pending aliases when both generation prompts later reuse one course", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
    });

    const prompts = await Promise.all(
      [0, 1].map((position) =>
        prisma.coursePrompt.create({
          data: {
            courseId: course.id,
            generationStatus: "completed",
            intent: "learn",
            language: "en",
            normalizedPrompt: `alias-${randomUUID()}-${position}`,
            prompt: `Alias ${randomUUID()}`,
          },
        }),
      ),
    );

    const track = await prisma.track.create({
      data: {
        request: {
          language: "en",
          subjects: prompts.map((prompt) => ({ coursePromptId: prompt.id, title: prompt.prompt })),
        },
        title: "Both aliases",
        userId: user.id,
      },
    });

    await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toMatchObject({
      courseId: course.id,
      status: "needsPlan",
    });

    await expect(getCurrentUserTrack({ trackId: track.id })).resolves.toMatchObject({
      status: "ready",
      track: { courses: [{ id: course.id }], pendingCourses: [], progress: { totalCourses: 1 } },
    });
  });

  it("does not apply an obsolete discovery goal when an answer changes during its safety check", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const brief = {
      description: "Private requirements",
      learningGoal: "Old goal",
      requirements: [],
      startingKnowledge: "Basics",
      title: "Private goal",
    };

    const discovery = await prisma.courseDiscovery.create({
      data: {
        brief,
        language: "en",
        prompt: "Old constraints",
        resolution: {
          brief,
          format: "core",
          question: null,
          reusableCoursePrompt: `Safe subject ${randomUUID()}`,
          status: "ready",
          targetLanguage: null,
        },
        status: "ready",
        userId: user.id,
      },
    });

    vi.mocked(classifyLearningRequest, { partial: true }).mockImplementation(async () => {
      await prisma.courseDiscovery.update({
        data: { revision: { increment: 1 }, status: "pending" },
        where: { id: discovery.id },
      });

      return { data: { intent: "learn", subjects: [], trackTitle: null } };
    });

    await expect(
      startCurrentUserCourseDiscovery({ discoveryId: discovery.id, expectedRevision: 1 }),
    ).resolves.toStrictEqual({ status: "conflict" });

    await expect(prisma.courseLearningPlan.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.courseDiscovery.findUnique({ where: { id: discovery.id } }),
    ).resolves.toMatchObject({ courseId: null, revision: 2, status: "pending" });
  });
});
