import { isLiveCallAvailable } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestCalls } from "../../_test-utils/connect-test-call";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageProgressView } from "../../view-models/language/get-language-progress-view";
import { getSpeakingPaper } from "./get-speaking-paper";

describe("the speaking paper read", () => {
  beforeEach(setupTestCalls);

  it("requires a session and hides another learner's goal", async () => {
    mockSession(null);

    await expect(getSpeakingPaper()).resolves.toStrictEqual({ status: "unauthorized" });

    const [{ goal }, other] = await Promise.all([languageGoalFixture(), userFixture()]);
    mockSession(other.id);

    await expect(getSpeakingPaper({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("preserves the no-goal and non-language states", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getSpeakingPaper()).resolves.toStrictEqual({ status: "noGoal" });

    const goal = await goalFixture({ userId: user.id });

    await expect(getSpeakingPaper({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notLanguage",
    });
  });

  it.each([false, true])("matches Progress's full task field with Plus: %s", async (plus) => {
    const { goal, user } = await languageGoalFixture();

    await prisma.goal.update({
      data: { details: { targetLevel: "B2" }, targetLanguage: "es" },
      where: { id: goal.id },
    });

    if (plus) {
      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      });
    }

    mockSession(user.id);

    const full = await countDatabaseStatements(() => getLanguageProgressView({ goalId: goal.id }));

    const narrow = await countDatabaseStatements(() => getSpeakingPaper({ goalId: goal.id }));

    if (full.result.status !== "ready") {
      throw new Error(`Expected Progress, got ${full.result.status}`);
    }

    expect(narrow.result).toStrictEqual({
      goalId: goal.id,
      paper: full.result.progress.speaking,
      status: "ready",
    });

    expect(narrow.result).toMatchObject({
      paper: { access: plus ? "open" : "plusRequired", exam: "dele", level: "B2" },
    });

    assertReadBudget(narrow, 16);
    expect(narrow.statements).toBeLessThan(full.statements);
  });

  it.each([false, true])("keeps past tries when calls are available: %s", async (available) => {
    const { goal, user } = await languageGoalFixture();

    await Promise.all([
      prisma.goal.update({
        data: { details: { targetLevel: "B2" }, targetLanguage: "es" },
        where: { id: goal.id },
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    const conversation = await prisma.languageConversation.create({
      data: {
        endedAt: new Date("2026-10-01T12:00:00Z"),
        feedback: {
          brief: false,
          criteria: [{ bandHigh: 3, bandLow: 3, criterion: "coherence", evidence: "", tip: "" }],
          focus: "coherence",
          heard: true,
          kind: "examSpeaking",
        },
        goalId: goal.id,
        kind: "examSpeaking",
        language: "en",
        level: "B2",
        minutes: 5,
        scenario: {
          examTask: {
            card: {
              instructions: [],
              photos: [],
              prompts: [],
              summary: "",
              table: null,
              text: null,
            },
            exam: "dele",
            level: "B2",
            task: "t3",
          },
        },
        status: "completed",
        targetLanguage: "es",
        titleSnapshot: "DELE B2 task 3",
        userId: user.id,
      },
    });

    mockSession(user.id);
    // Provider availability is external; the goal and its past try remain real database rows.
    vi.mocked(isLiveCallAvailable).mockReturnValue(available);

    const full = await getLanguageProgressView({ goalId: goal.id });
    const narrow = await getSpeakingPaper({ goalId: goal.id });

    if (full.status !== "ready" || narrow.status !== "ready") {
      throw new Error("Expected both speaking reads to be ready");
    }

    expect(narrow.paper).toStrictEqual(full.progress.speaking);
    expect(narrow.paper?.access).toBe(available ? "open" : "callsPaused");

    expect(narrow.paper?.tasks.find((task) => task.key === "t3")?.lastTry).toMatchObject({
      conversationId: conversation.id,
      rated: 1,
    });
  });
});
