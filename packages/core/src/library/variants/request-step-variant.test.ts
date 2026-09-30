import { randomUUID } from "node:crypto";
import { generateStepVariant } from "@zoonk/ai/tasks/v2/variants/step-variant";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { trackServerEvent } from "../../analytics/server";
import { requestStepVariant } from "./request-step-variant";
import type * as StepVariantTask from "@zoonk/ai/tasks/v2/variants/step-variant";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** The firewall and the model are external boundaries. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

vi.mock("@zoonk/ai/tasks/v2/variants/step-variant", async (importOriginal) => ({
  ...(await importOriginal<typeof StepVariantTask>()),
  generateStepVariant: vi.fn(),
}));

const content = { text: "A 25% discount takes a quarter off the price.", title: "Discounts" };

async function createStep(lesson: Parameters<typeof libraryLessonFixture>[0] = {}) {
  const created = await libraryLessonFixture({ contentStatus: "completed", ...lesson });
  return libraryStepFixture({ content, lessonId: created.id });
}

describe(requestStepVariant, () => {
  it("requires a session", async () => {
    mockSession(null);

    await expect(
      requestStepVariant({ kind: "simpler", stepId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("gives a guest the shared version without counting it toward the rate limit", async () => {
    const [guest, step] = await Promise.all([userFixture(), createStep()]);
    const stored = await stepVariantFixture({ content, kind: "deeper", stepId: step.id });
    mockGuestSession(guest.id);

    await expect(requestStepVariant({ kind: "deeper", stepId: step.id })).resolves.toStrictEqual({
      status: "ready",
      variant: { content, id: stored.id, kind: "deeper", stepId: step.id },
    });

    expect(isRateLimited).not.toHaveBeenCalled();
    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("reports the wait for a newly written version, and none for a stored one", async () => {
    const [learner, step] = await Promise.all([userFixture(), createStep()]);
    await stepVariantFixture({ content, kind: "deeper", stepId: step.id });
    mockSession(learner.id);

    vi.mocked(generateStepVariant).mockResolvedValueOnce({
      data: {
        exampleLineIdea: null,
        image: null,
        kind: "explanation",
        text: "25% off means you pay 3 of every 4 reais.",
        title: "A quarter off",
      },
      provenance: {
        generatedAt: new Date().toISOString(),
        latencyMs: 1,
        model: "openai/gpt-6-luna",
        promptVersion: "test",
        provider: "test",
        requestedModel: "openai/gpt-6-luna",
        runId: randomUUID(),
        usage: {},
      },
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    const flush = runDeferredWork();

    await expect(requestStepVariant({ kind: "simpler", stepId: step.id })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(requestStepVariant({ kind: "deeper", stepId: step.id })).resolves.toMatchObject({
      status: "ready",
    });

    await flush();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: learner.id,
        name: "Generation Waited",
        properties: { content_kind: "variant", milliseconds: expect.any(Number) },
      }),
    );
  });

  it("slows down a learner who asks for too many new versions", async () => {
    const [learner, step] = await Promise.all([userFixture(), createStep()]);
    mockSession(learner.id);
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);

    await expect(requestStepVariant({ kind: "simpler", stepId: step.id })).resolves.toStrictEqual({
      retryAfterSeconds: 60,
      status: "slowDown",
    });

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("asks a guest who used today's help to sign up before writing a new version", async () => {
    const step = await createStep();
    await useGuestOutOfHelp();

    await expect(requestStepVariant({ kind: "simpler", stepId: step.id })).resolves.toStrictEqual(
      GUEST_OUT_OF_HELP,
    );

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("hides screens of another learner's private lesson", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const step = await createStep({ ownerId: owner.id, visibility: "private" });
    await stepVariantFixture({ content, kind: "simpler", stepId: step.id });
    mockSession(other.id);

    await expect(requestStepVariant({ kind: "simpler", stepId: step.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
