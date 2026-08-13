import { randomUUID } from "node:crypto";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
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
      shouldClaimQuota: true,
      status: "ready",
      userId: user.id,
    });
  });

  it("allows guest generation without inventing an acting user", async () => {
    const prompt = await coursePromptFixture();

    await expect(getCourseGenerationAccess(prompt.id)).resolves.toStrictEqual({
      coursePromptId: prompt.id,
      shouldClaimQuota: true,
      status: "ready",
      userId: null,
    });
  });

  it("does not claim quota when a course generation is already running", async () => {
    const prompt = await coursePromptFixture({ generationStatus: "running" });

    await expect(getCourseGenerationAccess(prompt.id)).resolves.toMatchObject({
      shouldClaimQuota: false,
      status: "ready",
    });
  });

  it("distinguishes missing and invalid generation prompts", async () => {
    const invalidPrompt = await coursePromptFixture({ intent: "question" });

    const [missing, invalid] = await Promise.all([
      getCourseGenerationAccess(randomUUID()),
      getCourseGenerationAccess(invalidPrompt.id),
    ]);

    expect(missing).toStrictEqual({ status: "notFound" });
    expect(invalid).toStrictEqual({ error: "Course prompt is not generatable", status: "invalid" });
  });
});
