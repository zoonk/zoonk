import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import { prisma } from "@zoonk/db";
import { goalFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { prepareCheckpointCall } from "./prepare-language-calls";
import {
  openLanguageCheckpointCall,
  startLanguageConversation,
} from "./start-language-conversation";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// A unit's call is written by a paid model call.
vi.mock("@zoonk/ai/tasks/v2/language/conversation-scenario", () => ({
  generateConversationScenario: vi.fn(),
}));

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "openai/gpt-6-luna",
  promptVersion: "v-test",
  provider: "openai",
  requestedModel: "openai/gpt-6-luna",
  runId: "run-test",
  usage: {},
};

const B1_SCENARIO = { ...RENTING_SCENARIO, title: "Negociar o aluguel" };

/**
 * Marcos's language goal with the renting unit's boss reached today: a checkpoint block of today's
 * session closes it. `speaking` sets his speaking level; the renting unit's call is written at A2.
 */
async function reachedCheckpointFixture({ speaking }: { speaking: number }) {
  const setup = await languageGoalFixture();
  const { goal, plan, user } = setup;

  const [boss, session] = await Promise.all([
    planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    prisma.languageSkillLevel.create({
      data: {
        language: "en",
        score: speaking,
        skill: "speaking",
        startScore: speaking,
        userId: user.id,
      },
    }),
  ]);

  const block = await studySessionBlockFixture({
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: 0,
        phase: 1,
        rematch: false,
        timeLimitMinutes: null,
      },
      planItemId: boss.id,
    },
    sessionId: session.id,
  });

  mockSession(user.id);
  return { ...setup, block };
}

describe("language checkpoint calls", () => {
  beforeEach(() => {
    vi.mocked(generateConversationScenario).mockResolvedValue({
      data: B1_SCENARIO,
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    });
  });

  it("opens a checkpoint's call from its unit's written call without a model", async () => {
    const { block } = await reachedCheckpointFixture({ speaking: 1 });

    const first = await openLanguageCheckpointCall(block.id);
    const again = await openLanguageCheckpointCall(block.id);

    expect(first.status).toBe("ready");
    expect(again).toStrictEqual(first);
    expect(generateConversationScenario).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { studyBlockId: block.id } }),
    ).resolves.toMatchObject({
      kind: "checkpoint",
      level: "A2",
      titleSnapshot: RENTING_SCENARIO.title,
    });
  });

  it("leaves a checkpoint preparing when its call isn't written, and starting it writes the call", async () => {
    const { block, renting } = await reachedCheckpointFixture({ speaking: 2 });

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      status: "preparing",
      unitTitle: renting.title,
    });

    expect(generateConversationScenario).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
    ).resolves.toBe(0);

    const started = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    expect(started.status).toBe("ready");
    expect(generateConversationScenario).toHaveBeenCalledOnce();
    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual(started);
  });

  it("writes the next checkpoint's call ahead at the learner's level, once", async () => {
    const { block, goal, renting, user } = await reachedCheckpointFixture({ speaking: 2 });

    await prepareCheckpointCall({ goalId: goal.id, userId: user.id });
    await prepareCheckpointCall({ goalId: goal.id, userId: user.id });

    expect(generateConversationScenario).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ level: "B1", unitTitle: renting.title }),
    );

    const opened = await openLanguageCheckpointCall(block.id);

    expect(opened.status).toBe("ready");
    expect(generateConversationScenario).toHaveBeenCalledOnce();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { studyBlockId: block.id } }),
    ).resolves.toMatchObject({ level: "B1", titleSnapshot: B1_SCENARIO.title });
  });

  it("writes nothing ahead when the unit's call is written or the goal has no checkpoint call", async () => {
    const [written, noBoss, other] = await Promise.all([
      reachedCheckpointFixture({ speaking: 1 }),
      languageGoalFixture(),
      userFixture(),
    ]);

    const otherGoal = await goalFixture({ userId: other.id });

    await Promise.all([
      prepareCheckpointCall({ goalId: written.goal.id, userId: written.user.id }),
      prepareCheckpointCall({ goalId: noBoss.goal.id, userId: noBoss.user.id }),
      prepareCheckpointCall({ goalId: otherGoal.id, userId: other.id }),
    ]);

    expect(generateConversationScenario).not.toHaveBeenCalled();
  });

  it("keeps another learner's checkpoint closed", async () => {
    const { block } = await reachedCheckpointFixture({ speaking: 1 });
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      status: "notLanguage",
    });
  });
});
