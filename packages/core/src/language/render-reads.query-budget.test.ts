import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLanguageActivitySettings } from "./activities/skipped-activities";
import { liveCallFixture } from "./conversations/_test-utils/live-call-fixture";
import { getLanguageConversation } from "./conversations/get-language-conversation";
import { getMistakePattern } from "./patterns/get-mistake-pattern";
import { getPronunciationReviews } from "./pronunciation/get-pronunciation-reviews";

describe("language supporting render read budgets", () => {
  it("reads a saved conversation", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getLanguageConversation(conversation.id));
    assertReadBudget(counts, 3);
    expect(counts.result.status).toBe("ready");
  });

  it("reads plan activity settings", async () => {
    const { user } = await languageGoalFixture();
    mockSession(user.id);

    const counts = await countDatabaseStatements(() =>
      getLanguageActivitySettings({ targetLanguage: "en" }),
    );

    assertReadBudget(counts, 2);
    expect(counts.result).toStrictEqual({ skipped: [] });
  });

  it("reads due pronunciation words", async () => {
    const { user } = await languageGoalFixture();
    const organization = await aiOrganizationFixture();
    const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });
    await pronunciationReviewFixture({ userId: user.id, wordId: word.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getPronunciationReviews());
    assertReadBudget(counts, 6);
    expect(counts.result.status === "ready" && counts.result.reviews.words).toHaveLength(1);
  });

  it("reads a persisted mistake pattern", async () => {
    const { goal, user } = await languageGoalFixture();

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: { contrast: [], drill: [], examples: [], rule: "Use since for the start." },
        goalId: goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "Since",
        userId: user.id,
      },
    });

    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getMistakePattern(pattern.id));
    assertReadBudget(counts, 1);
    expect(counts.result.status).toBe("ready");
  });
});
