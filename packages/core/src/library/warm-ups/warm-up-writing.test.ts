import { checkWarmUpCards } from "@zoonk/ai/tasks/warm-up/check-warm-up-cards";
import { toWarmUpCards } from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { generateWarmUpCards } from "@zoonk/ai/tasks/warm-up/write-warm-up-cards";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { analytics } from "../../_test-utils/test-boundaries";
import { checkWarmUp } from "./check-warm-up";
import { type WarmUpClaim, claimWarmUp, failWarmUp, readWarmUpStatus } from "./claim-warm-up";
import { saveWarmUp } from "./save-warm-up";
import { warmUpDeckSchema } from "./warm-up-contract";
import { getWarmUpKey } from "./warm-up-key";
import { writeWarmUp } from "./write-warm-up";

function result<T>(data: T, model = "openai/gpt-6-luna") {
  return {
    data,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model,
      promptVersion: "test",
      provider: model.split("/")[0] ?? "test",
      requestedModel: model,
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {
      inputTokenDetails: {
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
        noCacheTokens: 0,
      },
      inputTokens: 0,
      outputTokenDetails: { reasoningTokens: undefined, textTokens: 0 },
      outputTokens: 0,
      totalTokens: 0,
    },
    userPrompt: "",
  };
}

function rawCards(count = 3) {
  return Array.from({ length: count }, (_, index) => ({
    options: [
      { correct: true, text: String(index + 2) },
      { correct: false, text: String(index + 3) },
    ],
    question: `What is ${index + 1} + 1?`,
    reveal: `Adding one to ${index + 1} gives ${index + 2}.`,
  }));
}

async function newGoals(count = 1) {
  const scope = {
    generalGoal: `Arithmetic ${crypto.randomUUID()}`,
    language: "en",
    ownerId: null,
    targetLanguage: null,
  };

  const goals = await Promise.all(
    Array.from({ length: count }, async () => {
      const user = await userFixture();
      return goalFixture({ userId: user.id });
    }),
  );

  return { goals, scope };
}

async function writeDeck({
  claim,
  goalId,
  workflowRunId,
}: {
  claim: WarmUpClaim;
  goalId: string;
  workflowRunId: string;
}) {
  if (claim.status !== "claimed") {
    throw new Error("Expected the test to own this deck");
  }

  const input = { id: claim.id, input: claim.input, workflowRunId };
  const written = await writeWarmUp(input);

  if (!written) {
    throw new Error("Expected the writer to hold the claim");
  }

  const checked = await checkWarmUp({ ...input, written });

  if (!checked) {
    throw new Error("Expected the checker to hold the claim");
  }

  return saveWarmUp({ checked, goalId, id: claim.id, workflowRunId, written });
}

describe("shared warm-up writing", () => {
  beforeEach(() => {
    vi.mocked(generateWarmUpCards).mockResolvedValue(result({ cards: rawCards() }));

    vi.mocked(checkWarmUpCards).mockImplementation(async ({ cards }) =>
      result(
        { verdicts: cards.map(({ id }) => ({ id, keep: true, problem: null })) },
        "anthropic/claude-haiku-5.5",
      ),
    );
  });

  it("records one deck save when the successful save is replayed", async () => {
    const { goals, scope } = await newGoals();
    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    const claim = await claimWarmUp(request);

    if (claim.status !== "claimed") {
      throw new Error("Expected the test to own this deck");
    }

    const written = result({ cards: toWarmUpCards(rawCards()) });

    const checked = result({
      verdicts: written.data.cards.map(({ id }) => ({ id, keep: true, problem: null })),
    });

    const input = {
      checked: { ...checked.data, provenance: checked.provenance },
      goalId: request.goalId,
      id: claim.id,
      workflowRunId: request.workflowRunId,
      written: { ...written.data, provenance: written.provenance },
    };

    const flush = runDeferredWork();

    await expect(saveWarmUp(input)).resolves.toBe(claim.id);
    await expect(saveWarmUp(input)).resolves.toBe(claim.id);
    await flush();

    expect(
      analytics.trackServerEvent.mock.calls.filter(
        ([event]) => event.properties.stage === "deck_saved",
      ),
    ).toHaveLength(1);
  });

  it("admits one writer for simultaneous goals, then links both when they observe ready", async () => {
    const { goals, scope } = await newGoals(2);
    const first = goals[0]!;
    const second = goals[1]!;

    const requests = [first, second].map((goal) => ({
      goalId: goal.id,
      scope,
      workflowRunId: crypto.randomUUID(),
    }));

    const claims = await Promise.all(requests.map((request) => claimWarmUp(request)));
    expect(claims.map(({ status }) => status).toSorted()).toStrictEqual(["claimed", "following"]);

    await expect(
      prisma.warmUp.count({ where: { goals: { some: { id: first.id } } } }),
    ).resolves.toBe(0);

    const owner = claims.findIndex(({ status }) => status === "claimed");
    const id = await writeDeck({ ...requests[owner]!, claim: claims[owner]! });
    expect(id).toBeTruthy();

    await readWarmUpStatus({ goalId: requests[1 - owner]!.goalId, id: id! });

    const linked = await prisma.goal.findMany({ where: { id: { in: [first.id, second.id] } } });
    expect(linked.map(({ warmUpId }) => warmUpId)).toStrictEqual([id, id]);
    expect(generateWarmUpCards).toHaveBeenCalledOnce();
    expect(checkWarmUpCards).toHaveBeenCalledOnce();
  });

  it("writes and checks a cold deck at the learner's tier, since the learner's wait shows it", async () => {
    const { goals, scope } = await newGoals();
    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };

    await writeDeck({ ...request, claim: await claimWarmUp(request) });

    expect(vi.mocked(generateWarmUpCards).mock.calls[0]?.[0].serviceTier).toBe("priority");
    expect(vi.mocked(checkWarmUpCards).mock.calls[0]?.[0].serviceTier).toBe("priority");
  });

  it("reuses ready content and makes repeated links without another model call", async () => {
    const { goals, scope } = await newGoals(2);
    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    const claim = await claimWarmUp(request);
    const id = await writeDeck({ ...request, claim });

    vi.clearAllMocks();

    const reuse = { goalId: goals[1]!.id, scope, workflowRunId: crypto.randomUUID() };
    await expect(claimWarmUp(reuse)).resolves.toStrictEqual({ id, status: "ready" });
    await expect(claimWarmUp(reuse)).resolves.toStrictEqual({ id, status: "ready" });

    expect(generateWarmUpCards).not.toHaveBeenCalled();
    expect(checkWarmUpCards).not.toHaveBeenCalled();

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: reuse.goalId } }),
    ).resolves.toMatchObject({ warmUpId: id });
  });

  it("reclaims a stale writer atomically and fences the old run's spend and publication", async () => {
    const { goals, scope } = await newGoals(3);
    const original = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    const old = await claimWarmUp(original);

    if (old.status !== "claimed") {
      throw new Error("Expected initial claim");
    }

    const written = await writeWarmUp({
      id: old.id,
      input: old.input,
      workflowRunId: original.workflowRunId,
    });

    expect(written).not.toBeNull();

    await prisma.warmUp.update({
      data: { claimedAt: new Date(Date.now() - 11 * 60 * 1000) },
      where: { id: old.id },
    });

    const requests = goals
      .slice(1)
      .map(({ id }) => ({ goalId: id, scope, workflowRunId: crypto.randomUUID() }));

    const claims = await Promise.all(requests.map((request) => claimWarmUp(request)));
    expect(claims.map(({ status }) => status).toSorted()).toStrictEqual(["claimed", "following"]);

    await expect(
      writeWarmUp({ id: old.id, input: old.input, workflowRunId: original.workflowRunId }),
    ).resolves.toBeNull();

    await expect(
      checkWarmUp({
        id: old.id,
        input: old.input,
        workflowRunId: original.workflowRunId,
        written: written!,
      }),
    ).resolves.toBeNull();

    await failWarmUp({ id: old.id, workflowRunId: original.workflowRunId });

    const owner = claims.findIndex(({ status }) => status === "claimed");
    await writeDeck({ ...requests[owner]!, claim: claims[owner]! });
    const before = await prisma.warmUp.findUniqueOrThrow({ where: { id: old.id } });

    await saveWarmUp({
      checked: { provenance: result({}).provenance, verdicts: [] },
      goalId: original.goalId,
      id: old.id,
      workflowRunId: original.workflowRunId,
      written: written!,
    });

    await expect(prisma.warmUp.findUniqueOrThrow({ where: { id: old.id } })).resolves.toStrictEqual(
      before,
    );

    expect(generateWarmUpCards).toHaveBeenCalledTimes(2);
    expect(checkWarmUpCards).toHaveBeenCalledOnce();
  });

  it("keeps at most eight approved cards in writer order", async () => {
    const { goals, scope } = await newGoals();
    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    vi.mocked(generateWarmUpCards).mockResolvedValue(result({ cards: rawCards(12) }));

    vi.mocked(checkWarmUpCards).mockImplementation(async ({ cards }) =>
      result({
        verdicts: cards.map(({ id }, index) => ({
          id,
          keep: index > 1,
          problem: index > 1 ? null : "The marked answer is wrong",
        })),
      }),
    );

    const id = await writeDeck({ ...request, claim: await claimWarmUp(request) });
    const stored = await prisma.warmUp.findUniqueOrThrow({ where: { id: id! } });

    const expected = vi
      .mocked(checkWarmUpCards)
      .mock.calls[0]![0].cards.slice(2, 10)
      .map((card) => ({ ...card, id: `${id}:${card.id}` }));

    expect(stored.cards).toStrictEqual(expected);

    expect(stored).toMatchObject({
      checkerModel: "openai/gpt-6-luna",
      promptVersion: "test",
      status: "ready",
      writerModel: "openai/gpt-6-luna",
    });
  });

  it("gives every saved card an id no other deck's card has", async () => {
    const [first, second] = await Promise.all([newGoals(), newGoals()]);

    const decks = await Promise.all(
      [first, second].map(async ({ goals, scope }) => {
        const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
        const id = await writeDeck({ ...request, claim: await claimWarmUp(request) });
        const stored = await prisma.warmUp.findUniqueOrThrow({ where: { id: id! } });
        return warmUpDeckSchema.parse(stored).cards.map((card) => card.id);
      }),
    );

    const ids = decks.flat();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("records failed content and never pays for the key again", async () => {
    const { goals, scope } = await newGoals(2);
    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    const claim = await claimWarmUp(request);
    vi.mocked(checkWarmUpCards).mockResolvedValue(result({ verdicts: [] }));

    await expect(writeDeck({ ...request, claim })).resolves.toBeNull();

    await expect(
      claimWarmUp({ ...request, goalId: goals[1]!.id, workflowRunId: crypto.randomUUID() }),
    ).resolves.toStrictEqual({ status: "none" });

    expect(generateWarmUpCards).toHaveBeenCalledOnce();
    expect(checkWarmUpCards).toHaveBeenCalledOnce();

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: request.goalId } }),
    ).resolves.toMatchObject({ warmUpId: null });
  });

  it("gives a private scope nothing", async () => {
    const { goals, scope } = await newGoals();

    await expect(
      claimWarmUp({
        goalId: goals[0]!.id,
        scope: { ...scope, ownerId: goals[0]!.userId },
        workflowRunId: crypto.randomUUID(),
      }),
    ).resolves.toStrictEqual({ status: "none" });

    expect(generateWarmUpCards).not.toHaveBeenCalled();

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: goals[0]!.id } }),
    ).resolves.toMatchObject({ warmUpId: null });
  });

  it("keeps app languages separate and never replaces a goal's first ready deck", async () => {
    const { goals, scope } = await newGoals(2);
    const first = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    const originalId = await writeDeck({ ...first, claim: await claimWarmUp(first) });

    await prisma.goal.update({ data: { language: "pt" }, where: { id: goals[1]!.id } });

    const second = { goalId: goals[1]!.id, scope, workflowRunId: crypto.randomUUID() };
    const otherId = await writeDeck({ ...second, claim: await claimWarmUp(second) });
    expect(otherId).not.toBe(originalId);

    await readWarmUpStatus({ goalId: first.goalId, id: otherId! });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: first.goalId } }),
    ).resolves.toMatchObject({ warmUpId: originalId });
  });

  it("replays the linked deck after a retry decides on a different general goal", async () => {
    const { goals, scope } = await newGoals();
    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    const id = await writeDeck({ ...request, claim: await claimWarmUp(request) });
    const nextScope = { ...scope, generalGoal: `Different subject ${crypto.randomUUID()}` };
    vi.clearAllMocks();

    await expect(
      claimWarmUp({ ...request, scope: nextScope, workflowRunId: crypto.randomUUID() }),
    ).resolves.toStrictEqual({ id, status: "ready" });

    await expect(
      prisma.warmUp.count({
        where: { identityKey: getWarmUpKey({ ...nextScope, kind: "learn" })! },
      }),
    ).resolves.toBe(0);

    expect(generateWarmUpCards).not.toHaveBeenCalled();
    expect(checkWarmUpCards).not.toHaveBeenCalled();
  });

  it("marks too few valid cards failed without paying for a checker", async () => {
    const { goals, scope } = await newGoals();
    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    const claim = await claimWarmUp(request);

    if (claim.status !== "claimed") {
      throw new Error("Expected the test to own this deck");
    }

    vi.mocked(generateWarmUpCards).mockResolvedValue(result({ cards: rawCards(1) }));

    const written = await writeWarmUp({
      id: claim.id,
      input: claim.input,
      workflowRunId: request.workflowRunId,
    });

    await expect(
      checkWarmUp({
        id: claim.id,
        input: claim.input,
        workflowRunId: request.workflowRunId,
        written: written!,
      }),
    ).resolves.toBeNull();

    expect(checkWarmUpCards).not.toHaveBeenCalled();

    await expect(
      prisma.warmUp.findUniqueOrThrow({ where: { id: claim.id } }),
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("sends only the general goal and public blueprint subject names to the models", async () => {
    const { goals, scope } = await newGoals();
    const prompt = `PERSONAL_PROMPT_${crypto.randomUUID()}`;
    const details = `PERSONAL_DETAILS_${crypto.randomUUID()}`;

    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          {
            citation: { passage: "Public", sourceId: "notice" },
            name: "Arithmetic",
            questions: null,
            topics: ["Addition"],
            weight: 1,
          },
        ],
      },
    });

    await prisma.goal.update({
      data: {
        details: { reason: details },
        examBlueprintId: blueprint.id,
        kind: "exam",
        prompt,
        title: prompt,
      },
      where: { id: goals[0]!.id },
    });

    const request = { goalId: goals[0]!.id, scope, workflowRunId: crypto.randomUUID() };
    await writeDeck({ ...request, claim: await claimWarmUp(request) });

    expect(generateWarmUpCards).toHaveBeenCalledExactlyOnceWith({
      analytics: undefined,
      goal: scope.generalGoal,
      kind: "exam",
      language: "en",
      serviceTier: "priority",
      subjects: ["Arithmetic"],
    });

    const inputs = JSON.stringify([
      vi.mocked(generateWarmUpCards).mock.calls,
      vi.mocked(checkWarmUpCards).mock.calls,
    ]);

    expect(inputs).not.toContain(prompt);
    expect(inputs).not.toContain(details);
  });
});
