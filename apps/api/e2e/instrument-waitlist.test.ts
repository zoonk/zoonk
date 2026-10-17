import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import {
  instrumentWaitlistEntryResponseSchema,
  instrumentWaitlistResponseSchema,
} from "../src/lib/openapi/schemas/instrument-waitlist";
import { createBearerLearner, createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Instrument waitlist API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });

    const responses = await Promise.all([
      api.get("/v1/me/instrument-waitlist"),
      api.post("/v1/me/instrument-waitlist", { data: { instrument: "guitar", language: "en" } }),
      api.delete(`/v1/me/instrument-waitlist/${randomUUID()}`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    await api.dispose();
  });

  test("joins once per instrument, lists and leaves", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "instrument-waitlist" });

    const joined = await readBody({
      response: await api.post("/v1/me/instrument-waitlist", {
        data: { instrument: "Violão", language: "pt" },
      }),
      schema: instrumentWaitlistEntryResponseSchema,
    });

    const again = await readBody({
      response: await api.post("/v1/me/instrument-waitlist", {
        data: { instrument: "violao ", language: "pt" },
      }),
      schema: instrumentWaitlistEntryResponseSchema,
    });

    expect(joined.entry).toMatchObject({ instrument: "Violão", language: "pt" });
    expect(again.entry.id).toBe(joined.entry.id);

    const listed = await readBody({
      response: await api.get("/v1/me/instrument-waitlist"),
      schema: instrumentWaitlistResponseSchema,
    });

    expect(listed.entries).toStrictEqual([joined.entry]);

    const left = await api.delete(`/v1/me/instrument-waitlist/${joined.entry.id}`);
    expect(left.status()).toBe(204);

    const gone = await api.delete(`/v1/me/instrument-waitlist/${joined.entry.id}`);
    expect(gone.status()).toBe(404);

    await expect(prisma.instrumentWaitlistEntry.count({ where: { userId } })).resolves.toBe(0);
    await api.dispose();
  });

  test("rejects invalid input and asks guests for an account", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "instrument-waitlist-invalid" });
    const invalid = await api.post("/v1/me/instrument-waitlist", { data: { instrument: "" } });
    expect(invalid.status()).toBe(400);
    await api.dispose();

    const { guestApi: guest } = await createGuest(baseURL);

    const response = await guest.post("/v1/me/instrument-waitlist", {
      data: { instrument: "piano", language: "en" },
    });

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "ACCOUNT_REQUIRED" } });
    await guest.dispose();
  });
});
