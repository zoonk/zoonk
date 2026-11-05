import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { liveCallFixture } from "./conversations/_test-utils/live-call-fixture";
import { getLanguageConversation } from "./conversations/get-language-conversation";
import { getMistakePattern } from "./patterns/get-mistake-pattern";
import { getPronunciationReviews } from "./pronunciation/get-pronunciation-reviews";

describe("language supporting render reads", () => {
  it("reads a saved conversation without writing", async () => {
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getLanguageConversation(conversation.id));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it("reads due pronunciation words without writing", async () => {
    const { user } = await languageGoalFixture();
    const organization = await aiOrganizationFixture();
    const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });
    await pronunciationReviewFixture({ userId: user.id, wordId: word.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getPronunciationReviews());
    expect(counts.writes).toBe(0);
    expect(counts.result.status === "ready" && counts.result.reviews.words).toHaveLength(1);
  });

  it("reads a persisted mistake pattern without writing", async () => {
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
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });
});
