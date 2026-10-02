import { type ExtractedMemoryFact, extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { reconcileMemoryFact } from "@zoonk/ai/tasks/v2/memory/reconcile";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { undoMemoryChanges } from "./undo-memory-changes";
import { scheduleMemoryUpdate, updateMemoryFromActivity } from "./update-memory-from-activity";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// Extraction, the gate and reconciling are paid model calls; their behavior is covered by evals.
vi.mock("@zoonk/ai/tasks/v2/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/gate", () => ({ gateMemoryFact: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/reconcile", () => ({ reconcileMemoryFact: vi.fn() }));

const ADULT_BIRTH = { birthMonth: 5, birthYear: 1990 };

const PROVENANCE = {
  generatedAt: "2026-09-26T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "memory-extraction-test",
  runId: "run-memory-test",
};

function extracted(fact: Partial<ExtractedMemoryFact>): ExtractedMemoryFact {
  return {
    category: "goals",
    evidence: "I want to study Law",
    expiresOn: null,
    intent: "remember",
    origin: "said",
    statement: "Wants Law",
    ...fact,
  };
}

function mockExtraction(facts: ExtractedMemoryFact[]) {
  vi.mocked(extractMemoryFacts).mockResolvedValue({
    data: { facts },
    provenance: PROVENANCE,
  } as Awaited<ReturnType<typeof extractMemoryFacts>>);
}

function mockGate(decision: "keep" | "notLasting" | "sensitive", sensitive = false) {
  vi.mocked(gateMemoryFact).mockResolvedValue({ decision, sensitive } as Awaited<
    ReturnType<typeof gateMemoryFact>
  >);
}

function mockReconcile(
  decision: NonNullable<Awaited<ReturnType<typeof reconcileMemoryFact>>>["decision"],
) {
  vi.mocked(reconcileMemoryFact).mockResolvedValue({ decision } as Awaited<
    ReturnType<typeof reconcileMemoryFact>
  >);
}

async function adult() {
  const user = await userFixture();
  await learningProfileFixture({ ...ADULT_BIRTH, userId: user.id });
  return user;
}

function chat(userId: string, text = "I switched from Medicine to Law") {
  return {
    source: {
      id: "chat-1",
      kind: "chat" as const,
      language: "en",
      messages: [{ role: "learner" as const, text }],
    },
    timeZone: "America/Sao_Paulo",
    userId,
  };
}

describe(updateMemoryFromActivity, () => {
  beforeEach(() => {
    mockGate("keep");
    vi.mocked(reconcileMemoryFact).mockResolvedValue(null);
  });

  it("adds a new fact from a chat with its source, confidence and provenance", async () => {
    const user = await adult();
    mockExtraction([extracted({ expiresOn: "2099-11-08" })]);

    const changes = await updateMemoryFromActivity(chat(user.id));

    expect(changes).toMatchObject([
      { action: "added", fact: { statement: "Wants Law" }, previous: null },
    ]);

    expect(extractMemoryFacts).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ["goals", "background", "routine", "preferences", "learning", "context"],
        input: "Learner: I switched from Medicine to Law",
        language: "en",
        source: "chat",
      }),
    );

    const stored = await prisma.memoryFact.findFirstOrThrow({ where: { userId: user.id } });

    expect(stored).toMatchObject({
      category: "goals",
      confidence: 0.9,
      expiresAt: new Date("2099-11-09T00:00:00.000Z"),
      model: "openai/gpt-6-luna",
      origin: "said",
      promptVersion: "memory-extraction-test",
      runId: "run-memory-test",
      sensitive: false,
      sourceRef: { id: "chat-1", kind: "chat" },
      status: "active",
    });

    expect(gateMemoryFact).toHaveBeenCalledWith({
      allowSensitive: true,
      candidate: expect.objectContaining({
        evidence: "I want to study Law",
        statement: "Wants Law",
      }),
    });
  });

  it("replaces the fact a new one updates, and undo puts the old one back", async () => {
    const user = await adult();
    mockSession(user.id);
    const medicine = await memoryFactFixture({ statement: "Wants Medicine", userId: user.id });
    mockExtraction([extracted({})]);
    mockReconcile({ action: "replace", index: 0 });

    const [change] = await updateMemoryFromActivity(chat(user.id));

    expect(change).toMatchObject({
      action: "replaced",
      fact: { statement: "Wants Law" },
      previous: { id: medicine.id, statement: "Wants Medicine" },
    });

    expect(reconcileMemoryFact).toHaveBeenCalledWith({
      existing: [expect.objectContaining({ id: medicine.id })],
      fact: expect.objectContaining({ intent: "remember", statement: "Wants Law" }),
    });

    const replaced = await prisma.memoryFact.findUniqueOrThrow({ where: { id: medicine.id } });
    expect(replaced).toMatchObject({ status: "superseded", supersededById: change?.fact?.id });

    await undoMemoryChanges({
      changes: [{ factId: change?.fact?.id ?? null, previousFactId: medicine.id }],
    });

    const active = await prisma.memoryFact.findMany({
      where: { status: "active", userId: user.id },
    });

    expect(active.map((fact) => fact.statement)).toStrictEqual(["Wants Medicine"]);
  });

  it("removes what the learner asks to forget without asking the gate", async () => {
    const user = await adult();

    const football = await memoryFactFixture({
      category: "context",
      statement: "Plays football on weekends",
      userId: user.id,
    });

    mockExtraction([
      extracted({ category: "context", intent: "forget", statement: "Plays football" }),
    ]);

    mockReconcile({ action: "remove", index: 0 });

    const changes = await updateMemoryFromActivity(chat(user.id, "Forget the football thing"));

    expect(changes).toMatchObject([
      { action: "removed", fact: null, previous: { id: football.id } },
    ]);

    expect(gateMemoryFact).not.toHaveBeenCalled();

    const removed = await prisma.memoryFact.findUniqueOrThrow({ where: { id: football.id } });
    expect(removed.status).toBe("deleted");
  });

  it("stores nothing the gate drops and never adds a fact to forget", async () => {
    const user = await adult();

    mockExtraction([
      extracted({ category: "background", statement: "Has asthma" }),
      extracted({ intent: "forget", statement: "Wants Medicine" }),
    ]);

    mockGate("sensitive", true);

    await expect(updateMemoryFromActivity(chat(user.id))).resolves.toStrictEqual([]);
    await expect(prisma.memoryFact.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("keeps a sensitive fact an adult asked to remember, flagged as sensitive", async () => {
    const user = await adult();
    mockExtraction([extracted({ category: "learning", statement: "Has ADHD" })]);
    mockGate("keep", true);

    await updateMemoryFromActivity(chat(user.id, "Remember that I have ADHD"));

    const stored = await prisma.memoryFact.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored).toMatchObject({ sensitive: true, statement: "Has ADHD" });
  });

  it("ignores an exact repeat without asking the reconcile model", async () => {
    const user = await adult();
    await memoryFactFixture({ statement: "Wants law", userId: user.id });
    mockExtraction([extracted({ statement: "Wants Law" })]);

    await expect(updateMemoryFromActivity(chat(user.id))).resolves.toStrictEqual([]);
    expect(reconcileMemoryFact).not.toHaveBeenCalled();
    await expect(prisma.memoryFact.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("learns nothing while memory is off", async () => {
    const user = await adult();
    await learningProfileFixture({ memoryEnabled: false, userId: user.id });

    await expect(updateMemoryFromActivity(chat(user.id))).resolves.toStrictEqual([]);
    expect(extractMemoryFacts).not.toHaveBeenCalled();
  });

  it("keeps only goals and learning for learners of unknown age, and never sensitive ones", async () => {
    const user = await userFixture();

    mockExtraction([
      extracted({ category: "context", statement: "Lives in Recife" }),
      extracted({ category: "learning", statement: "Mixes up fractions" }),
    ]);

    await updateMemoryFromActivity(chat(user.id));

    expect(extractMemoryFacts).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ["goals", "learning"] }),
    );

    expect(gateMemoryFact).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ allowSensitive: false }),
    );

    const stored = await prisma.memoryFact.findMany({ where: { userId: user.id } });
    expect(stored.map((fact) => fact.statement)).toStrictEqual(["Mixes up fractions"]);
  });

  it("reads onboarding answers from the learner's goal", async () => {
    const user = await adult();

    const goal = await goalFixture({
      dailyMinutes: 45,
      details: { targetScore: "700 in the essay" },
      language: "pt",
      prompt: "Quero passar no ENEM para Direito",
      title: "ENEM 2026",
      userId: user.id,
    });

    mockExtraction([extracted({ statement: "Quer Direito" })]);

    await updateMemoryFromActivity({
      goalId: goal.id,
      source: { goalId: goal.id, kind: "onboarding" },
      userId: user.id,
    });

    expect(extractMemoryFacts).toHaveBeenCalledWith(
      expect.objectContaining({
        input: [
          "In their words: Quero passar no ENEM para Direito",
          "Goal: ENEM 2026",
          "Daily study time: 45 minutes",
          "targetScore: 700 in the essay",
        ].join("\n"),
        language: "pt",
        source: "onboarding",
      }),
    );

    const stored = await prisma.memoryFact.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.sourceRef).toStrictEqual({ id: goal.id, kind: "onboarding" });
  });

  it("doesn't read another learner's goal", async () => {
    const [owner, learner] = await Promise.all([userFixture(), adult()]);
    const goal = await goalFixture({ userId: owner.id });

    await expect(
      updateMemoryFromActivity({
        source: { goalId: goal.id, kind: "onboarding" },
        userId: learner.id,
      }),
    ).resolves.toStrictEqual([]);

    expect(extractMemoryFacts).not.toHaveBeenCalled();
  });

  it("keeps only noticed learning and routine facts from session numbers", async () => {
    const user = await adult();

    mockExtraction([
      extracted({ category: "goals", origin: "noticed", statement: "Wants a high score" }),
      extracted({ category: "routine", origin: "said", statement: "Studies after 8 pm" }),
    ]);

    await updateMemoryFromActivity({
      source: {
        activity: "Answers in the last 7 days: 40",
        id: null,
        kind: "session",
        language: "en",
      },
      userId: user.id,
    });

    const stored = await prisma.memoryFact.findMany({ where: { userId: user.id } });

    expect(stored).toMatchObject([
      { category: "routine", confidence: 0.6, origin: "noticed", statement: "Studies after 8 pm" },
    ]);
  });

  it("changes nothing when another update replaced the fact first", async () => {
    const user = await adult();
    const medicine = await memoryFactFixture({ statement: "Wants Medicine", userId: user.id });
    mockExtraction([extracted({})]);

    vi.mocked(reconcileMemoryFact).mockImplementation(async () => {
      await prisma.memoryFact.update({
        data: { status: "superseded" },
        where: { id: medicine.id },
      });

      return { decision: { action: "replace", index: 0 } } as Awaited<
        ReturnType<typeof reconcileMemoryFact>
      >;
    });

    await expect(updateMemoryFromActivity(chat(user.id))).resolves.toStrictEqual([]);

    const active = await prisma.memoryFact.count({ where: { status: "active", userId: user.id } });
    expect(active).toBe(0);
  });
});

describe(scheduleMemoryUpdate, () => {
  it("learns after the response is sent", async () => {
    const user = await adult();
    mockGate("keep");
    vi.mocked(reconcileMemoryFact).mockResolvedValue(null);
    mockExtraction([extracted({})]);

    scheduleMemoryUpdate(chat(user.id));

    await expect(prisma.memoryFact.count({ where: { userId: user.id } })).resolves.toBe(0);

    const [[task]] = vi.mocked(after).mock.calls as [[() => Promise<void>]];
    await task();

    await expect(prisma.memoryFact.count({ where: { userId: user.id } })).resolves.toBe(1);
  });
});
