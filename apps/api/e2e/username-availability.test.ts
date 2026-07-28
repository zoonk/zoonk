import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { userFixture } from "@zoonk/testing/fixtures/users";

test.describe("Username Availability API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("reports normalized available, taken, and reserved usernames", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const takenUsername = `taken_${uniqueId}`;
    const availableUsername = `available_${uniqueId}`;
    const user = await userFixture();

    await prisma.user.update({ data: { username: takenUsername }, where: { id: user.id } });

    const apiContext = await request.newContext({ baseURL });

    const [availableResponse, takenResponse, reservedResponse] = await Promise.all([
      apiContext.get(`/v1/usernames/${availableUsername.toUpperCase()}/availability`),
      apiContext.get(`/v1/usernames/${takenUsername}/availability`),
      apiContext.get("/v1/usernames/admin/availability"),
    ]);

    expect(availableResponse.status()).toBe(200);

    await expect(availableResponse.json()).resolves.toStrictEqual({
      isAvailable: true,
      username: availableUsername,
    });

    expect(takenResponse.status()).toBe(200);

    await expect(takenResponse.json()).resolves.toStrictEqual({
      isAvailable: false,
      username: takenUsername,
    });

    expect(reservedResponse.status()).toBe(200);

    await expect(reservedResponse.json()).resolves.toStrictEqual({
      isAvailable: false,
      username: "admin",
    });

    await apiContext.dispose();
  });

  test("rejects invalid username syntax", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/usernames/a/availability");

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    await apiContext.dispose();
  });
});
