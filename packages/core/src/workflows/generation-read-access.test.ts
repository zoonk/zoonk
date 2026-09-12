import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { getGenerationReadAccess } from "./generation-read-access";
import { registerGenerationRun } from "./internal/register-generation-run";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe("durable generation read access", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(null));

  it("reads a public run before its first step and after active claim cleanup", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      generationRunId: null,
      generationStatus: "pending",
      organizationId: organization.id,
    });

    const generationId = `run-${randomUUID()}`;
    await registerGenerationRun({ generationId, target: { courseId: course.id } });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "ready",
    });

    await prisma.course.update({
      data: { generationRunId: `new-${randomUUID()}`, generationStatus: "running" },
      where: { id: course.id },
    });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "ready",
    });

    await prisma.course.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: course.id },
    });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "ready",
    });
  });

  it("keeps a private failed run owner-only and never rebinds a duplicate identifier", async () => {
    const [owner, other, organization] = await Promise.all([
      userFixture(),
      userFixture(),
      aiOrganizationFixture(),
    ]);

    const privateCourse = await courseFixture({
      format: "personalized",
      generationStatus: "failed",
      organizationId: null,
      userId: owner.id,
    });

    const publicCourse = await courseFixture({ organizationId: organization.id });
    const generationId = `run-${randomUUID()}`;
    await registerGenerationRun({ generationId, target: { courseId: privateCourse.id } });
    await registerGenerationRun({ generationId, target: { courseId: publicCourse.id } });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "notFound",
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: other });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "notFound",
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: owner });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "ready",
    });

    await prisma.course.delete({ where: { id: privateCourse.id } });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("reads an accepted public course prompt before it has a course and revokes deleted targets", async () => {
    const prompt = await coursePromptFixture({
      generationRunId: null,
      generationStatus: "pending",
    });

    const generationId = `run-${randomUUID()}`;
    await registerGenerationRun({ generationId, target: { coursePromptId: prompt.id } });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "ready",
    });

    await prisma.coursePrompt.delete({ where: { id: prompt.id } });

    await expect(getGenerationReadAccess({ generationId })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      getGenerationReadAccess({ generationId: `unknown-${randomUUID()}` }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
