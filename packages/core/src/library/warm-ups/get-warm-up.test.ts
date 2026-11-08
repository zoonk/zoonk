import { randomUUID } from "node:crypto";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { warmUpFixture } from "@zoonk/testing/fixtures/warm-ups";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getGoalWarmUp, getWarmUp } from "./get-warm-up";

describe(getWarmUp, () => {
  it("serves a ready deck, answers included, to a guest", async () => {
    const [guest, deck] = await Promise.all([userFixture(), warmUpFixture({ language: "pt" })]);
    mockGuestSession(guest.id);

    const result = await getWarmUp(deck.id.toUpperCase());

    expect(result).toStrictEqual({
      deck: { cards: deck.cards, id: deck.id, language: "pt" },
      status: "ready",
    });
  });

  it("serves nothing without a session, nor a deck still being written, failed or missing", async () => {
    const [user, writing, failed] = await Promise.all([
      userFixture(),
      warmUpFixture({ cards: undefined, status: "writing" }),
      warmUpFixture({ status: "failed" }),
    ]);

    mockSession(null);
    await expect(getWarmUp(writing.id)).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(user.id);

    const results = await Promise.all(
      [writing.id, failed.id, randomUUID(), "not-a-deck"].map((id) => getWarmUp(id)),
    );

    expect(results).toStrictEqual(Array.from({ length: 4 }, () => ({ status: "notFound" })));
  });
});

describe(getGoalWarmUp, () => {
  it("reads the learner's own goal's deck once it's ready, and nobody else's", async () => {
    const [learner, other, deck, writing] = await Promise.all([
      userFixture(),
      userFixture(),
      warmUpFixture(),
      warmUpFixture({ cards: undefined, status: "writing" }),
    ]);

    const [goal, pending] = await Promise.all([
      goalFixture({ userId: learner.id, warmUpId: deck.id }),
      goalFixture({ userId: learner.id, warmUpId: writing.id }),
    ]);

    mockSession(learner.id);

    await expect(getGoalWarmUp(goal.id)).resolves.toStrictEqual({
      cards: deck.cards,
      id: deck.id,
      language: deck.language,
    });

    await expect(getGoalWarmUp(pending.id)).resolves.toBeNull();

    mockSession(other.id);
    await expect(getGoalWarmUp(goal.id)).resolves.toBeNull();
  });
});
