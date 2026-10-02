import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storeWebSource } from "../sources/web-sources";
import { checkFreshness } from "./check-freshness";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const DAY_MS = 86_400_000;

// The board's site is an external boundary: each test serves its notice from memory.
function servePage(text: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(`<p>${text}</p>`, { headers: { "content-type": "text/html" } })),
    ),
  );
}

function daysFromNow(days: number) {
  return new Date(NOW.getTime() + days * DAY_MS);
}

async function examWithLearner({
  examDate,
  registrationEndsAt = null,
}: {
  examDate: Date;
  registrationEndsAt?: Date | null;
}) {
  servePage("A prova terá 50 questões.");

  const source = await storeWebSource({
    kind: "official",
    language: "pt",
    publisher: null,
    title: "Edital",
    topic: "exam",
    url: `https://example.gov.br/${randomUUID()}`,
  });

  const blueprint = await examBlueprintFixture({
    edition: {
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: 50,
      sourceHash: source.contentHash,
      year: 2026,
    },
    examDate,
    registrationEndsAt,
    sourceId: source.id,
    structure: { formats: [], mock: null, rules: [], subjects: [] },
  });

  const user = await userFixture();
  await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });

  return { blueprint, source };
}

describe(checkFreshness, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks tomorrow while registration is open, without a model when nothing changed", async () => {
    const { blueprint } = await examWithLearner({
      examDate: daysFromNow(60),
      registrationEndsAt: daysFromNow(10),
    });

    const check = await checkFreshness({
      now: NOW,
      target: { examBlueprintId: blueprint.id, kind: "exam" },
    });

    expect(check).toStrictEqual({
      blueprintUpdate: null,
      nextCheckAt: daysFromNow(1).toISOString(),
      sourceChange: null,
      status: "scheduled",
    });

    const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });
    expect(stored.nextCheckAt).toStrictEqual(daysFromNow(1));
  });

  it("asks for a blueprint update when the notice changed", async () => {
    const { blueprint, source } = await examWithLearner({ examDate: daysFromNow(90) });
    servePage("A prova terá 60 questões.");

    const check = await checkFreshness({
      now: NOW,
      target: { examBlueprintId: blueprint.id, kind: "exam" },
    });

    expect(check).toMatchObject({
      blueprintUpdate: { examBlueprintId: blueprint.id, sourceId: source.id },
      nextCheckAt: daysFromNow(7).toISOString(),
      status: "scheduled",
    });
  });

  it("keeps the loop and checks tomorrow when the board's site is down", async () => {
    const { blueprint } = await examWithLearner({ examDate: daysFromNow(90) });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ECONNRESET"))),
    );

    const check = await checkFreshness({
      now: NOW,
      target: { examBlueprintId: blueprint.id, kind: "exam" },
    });

    expect(check).toMatchObject({
      blueprintUpdate: null,
      nextCheckAt: daysFromNow(1).toISOString(),
      status: "scheduled",
    });
  });

  it("stops once the exam has passed and clears the next check", async () => {
    const { blueprint } = await examWithLearner({ examDate: daysFromNow(-3) });

    await expect(
      checkFreshness({ now: NOW, target: { examBlueprintId: blueprint.id, kind: "exam" } }),
    ).resolves.toStrictEqual({ reason: "examPassed", status: "stopped" });

    const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });
    expect(stored.nextCheckAt).toBeNull();
  });

  it("stops when nobody studies the exam anymore", async () => {
    const { blueprint } = await examWithLearner({ examDate: daysFromNow(90) });

    await prisma.goal.updateMany({
      data: { status: "completed" },
      where: { examBlueprintId: blueprint.id },
    });

    await expect(
      checkFreshness({ now: NOW, target: { examBlueprintId: blueprint.id, kind: "exam" } }),
    ).resolves.toStrictEqual({ reason: "noLearners", status: "stopped" });
  });

  it("stops when the exam's notice was an upload with nothing to fetch", async () => {
    const user = await userFixture();
    const source = await sourceFixture({ kind: "upload", url: null });

    const blueprint = await examBlueprintFixture({
      examDate: daysFromNow(30),
      sourceId: source.id,
    });

    await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });

    await expect(
      checkFreshness({ now: NOW, target: { examBlueprintId: blueprint.id, kind: "exam" } }),
    ).resolves.toStrictEqual({ reason: "noUrl", status: "stopped" });
  });

  it("reports what changed in a source learners rely on", async () => {
    servePage("Alíquota de 15%.");

    const source = await storeWebSource({
      kind: "official",
      language: "pt",
      publisher: null,
      title: "Lei",
      topic: "regulation",
      url: `https://www.planalto.gov.br/${randomUUID()}`,
    });

    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    await learnerSourceFixture({
      goalId: goal.id,
      origin: "research",
      sourceId: source.id,
      userId: user.id,
    });

    servePage("Alíquota de 17%.");

    const check = await checkFreshness({
      now: NOW,
      target: { kind: "source", sourceId: source.id },
    });

    expect(check).toMatchObject({
      blueprintUpdate: null,
      sourceChange: {
        change: "- Alíquota de 15%.\n+ Alíquota de 17%.",
        language: "pt",
        previousHash: source.contentHash,
        sourceId: source.id,
      },
      status: "scheduled",
    });
  });

  it("stops checking a source nobody studies", async () => {
    const source = await sourceFixture();

    await expect(
      checkFreshness({ now: NOW, target: { kind: "source", sourceId: source.id } }),
    ).resolves.toStrictEqual({ reason: "noLearners", status: "stopped" });
  });
});
