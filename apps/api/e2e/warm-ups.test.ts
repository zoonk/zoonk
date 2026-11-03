import { request } from "@playwright/test";
import { warmUpDeckSchema } from "@zoonk/core/library/warm-ups/contract";
import { expect, test } from "@zoonk/e2e/fixtures";
import { warmUpFixture } from "@zoonk/testing/fixtures/warm-ups";
import { createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Warm-up decks API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("a guest reads a ready deck with its answers; nobody reads one without a session or before it's ready", async () => {
    const [{ guestApi }, anonymous, ready, writing] = await Promise.all([
      createGuest(baseURL),
      request.newContext({ baseURL }),
      warmUpFixture(),
      warmUpFixture({ cards: undefined, status: "writing" }),
    ]);

    await expect(
      readBody({
        response: await guestApi.get(`/v1/warm-ups/${ready.id}`),
        schema: warmUpDeckSchema,
      }),
    ).resolves.toStrictEqual({ cards: ready.cards, id: ready.id, language: ready.language });

    const statuses = await Promise.all([
      anonymous.get(`/v1/warm-ups/${ready.id}`),
      guestApi.get(`/v1/warm-ups/${writing.id}`),
      guestApi.get("/v1/warm-ups/not-a-deck"),
    ]);

    expect(statuses.map((response) => response.status())).toStrictEqual([401, 404, 400]);

    await Promise.all([guestApi.dispose(), anonymous.dispose()]);
  });
});
