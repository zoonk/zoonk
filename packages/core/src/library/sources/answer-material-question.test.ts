import { randomUUID } from "node:crypto";
import { answerFromMaterial } from "@zoonk/ai/tasks/v2/material/answer";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { trackServerEvent } from "../../analytics/server";
import { answerMaterialQuestion } from "./answer-material-question";
import { PAGE_BREAK, PPTX_CONTENT_TYPE } from "./source-contract";
import type * as RateLimitModule from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/material/answer", () => ({ answerFromMaterial: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimitModule>()),
  isRateLimited: vi.fn(),
}));

function mockAnswer(data: { answer: string; found: boolean; refs: string[] }) {
  vi.mocked(answerFromMaterial).mockResolvedValueOnce({
    data,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function learnerWithSlides() {
  const user = await userFixture();

  const slides = await sourceFixture({
    extractedText: ["Glicólise", "Saldo: 2 ATP por glicose"].join(PAGE_BREAK),
    kind: "upload",
    mimeType: PPTX_CONTENT_TYPE,
    ownerId: user.id,
    title: "Aula 5",
    visibility: "private",
  });

  await learnerSourceFixture({ sourceId: slides.id, userId: user.id });
  mockSession(user.id);

  return { slides, user };
}

describe(answerMaterialQuestion, () => {
  beforeEach(() => {
    mockSession(null);
    vi.mocked(headers).mockResolvedValue(new Headers());
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("answers from the learner's own material with the slides it came from", async () => {
    const { slides, user } = await learnerWithSlides();
    mockAnswer({ answer: "Sobram 2 ATP por glicose.", found: true, refs: ["S1:2", "S1:7"] });

    const result = await answerMaterialQuestion({
      language: "pt",
      question: "Qual o saldo da glicólise?",
      sourceIds: [slides.id],
    });

    expect(result).toStrictEqual({
      answer: {
        answer: "Sobram 2 ATP por glicose.",
        citations: [{ page: 2, title: "Aula 5", unit: "slide" }],
        found: true,
      },
      status: "answered",
    });

    expect(vi.mocked(answerFromMaterial).mock.calls.at(-1)?.[0].material).toContain(
      '<page ref="S1:2" of="Aula 5, slide 2">',
    );

    // Each question is a tutor message against the learner's allowance.
    await expect(
      prisma.usageRecord.count({ where: { kind: "tutorMessage", userId: user.id } }),
    ).resolves.toBe(1);
  });

  it('sends "Tutor Asked" about the material after the response, from the client that asked', async () => {
    const { slides, user } = await learnerWithSlides();
    mockAnswer({ answer: "Sobram 2 ATP por glicose.", found: true, refs: ["S1:2"] });

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "user-agent": "Zoonk/42 CFNetwork/3826.500.111 Darwin/25.0.0" }),
    );

    const flush = runDeferredWork();

    await answerMaterialQuestion({
      language: "pt",
      question: "Qual o saldo da glicólise?",
      sourceIds: [slides.id],
    });

    await flush();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Tutor Asked",
        properties: { scope: "material" },
        shared: expect.objectContaining({ platform: "ios" }),
      }),
    );
  });

  it("never answers from another learner's material", async () => {
    const { slides } = await learnerWithSlides();
    const other = await userFixture();
    mockSession(other.id);

    await expect(
      answerMaterialQuestion({ language: "pt", question: "O que é ATP?", sourceIds: [slides.id] }),
    ).resolves.toStrictEqual({ status: "notFound" });

    expect(answerFromMaterial).not.toHaveBeenCalledWith(
      expect.objectContaining({ question: "O que é ATP?" }),
    );
  });

  it("requires a session", async () => {
    await expect(
      answerMaterialQuestion({ language: "pt", question: "Oi?", sourceIds: [randomUUID()] }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
