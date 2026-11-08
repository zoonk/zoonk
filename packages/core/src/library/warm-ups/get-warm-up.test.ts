import { randomUUID } from "node:crypto";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { warmUpFixture } from "@zoonk/testing/fixtures/warm-ups";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getWarmUp } from "./get-warm-up";

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
