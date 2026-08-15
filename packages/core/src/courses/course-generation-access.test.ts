import { randomUUID } from "node:crypto";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { getCourseGenerationAccess } from "./course-generation-access";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getCourseGenerationAccess, () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(null));

  it("returns a workflow input with identity derived from the session", async () => {
    const [prompt, user] = await Promise.all([coursePromptFixture(), userFixture()]);
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await expect(getCourseGenerationAccess(prompt.id)).resolves.toStrictEqual({
      coursePromptId: prompt.id,
      courseSlug: null,
      shouldClaimQuota: true,
      status: "ready",
      userId: user.id,
    });
  });

  it("requires authentication before course generation", async () => {
    const prompt = await coursePromptFixture();

    await expect(getCourseGenerationAccess(prompt.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("returns the existing course slug without another generation lookup", async () => {
    const [course, user] = await Promise.all([courseFixture(), userFixture()]);
    const prompt = await coursePromptFixture({ courseId: course.id, generationStatus: "failed" });
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await expect(getCourseGenerationAccess(prompt.id)).resolves.toMatchObject({
      courseSlug: course.slug,
      shouldClaimQuota: true,
      status: "ready",
    });
  });

  it("does not claim quota when a course generation is already running", async () => {
    const [prompt, user] = await Promise.all([
      coursePromptFixture({ generationStatus: "running" }),
      userFixture(),
    ]);

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await expect(getCourseGenerationAccess(prompt.id)).resolves.toMatchObject({
      shouldClaimQuota: false,
      status: "ready",
    });
  });

  it("distinguishes missing and invalid generation prompts", async () => {
    const [invalidPrompt, user] = await Promise.all([
      coursePromptFixture({ intent: "question" }),
      userFixture(),
    ]);

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const [missing, invalid] = await Promise.all([
      getCourseGenerationAccess(randomUUID()),
      getCourseGenerationAccess(invalidPrompt.id),
    ]);

    expect(missing).toStrictEqual({ status: "notFound" });
    expect(invalid).toStrictEqual({ error: "Course prompt is not generatable", status: "invalid" });
  });
});
