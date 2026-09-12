import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createAuthenticatedApiContext } from "./helpers/auth";

const PROFILE_PATH = "/v1/me/learning-profile";

test.describe("Current learner interests API", () => {
  test("requires authentication for reads and updates", async () => {
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

    const [read, update] = await Promise.all([
      apiContext.get(PROFILE_PATH),
      apiContext.patch(PROFILE_PATH, { data: { interests: ["Science"] } }),
    ]);

    expect(read.status()).toBe(401);
    expect(update.status()).toBe(401);
    await apiContext.dispose();
  });

  test("returns an empty profile without creating preferences on a read", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "interests-empty",
    });

    const response = await apiContext.get(PROFILE_PATH);

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ interests: [] });

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();

    await apiContext.dispose();
  });

  test("saves and clears interests without changing other learner preferences", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "interests-update",
    });

    const preferences = { unrelatedPreference: "preserve" };

    await prisma.userLearningProfile.create({
      data: { instructions: "Keep my learning instructions", preferences, userId: user.id },
    });

    const update = await apiContext.patch(PROFILE_PATH, {
      data: { interests: ["Sports", "Science fiction"] },
    });

    expect(update.status()).toBe(200);
    await expect(update.json()).resolves.toEqual({ interests: ["Sports", "Science fiction"] });

    const read = await apiContext.get(PROFILE_PATH);
    expect(read.status()).toBe(200);
    await expect(read.json()).resolves.toEqual({ interests: ["Sports", "Science fiction"] });

    const clear = await apiContext.patch(PROFILE_PATH, { data: { interests: [] } });
    expect(clear.status()).toBe(200);
    await expect(clear.json()).resolves.toEqual({ interests: [] });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({
      instructions: "Keep my learning instructions",
      interests: [],
      preferences,
    });

    await apiContext.dispose();
  });

  test("keeps interests private to the authenticated account", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [owner, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "interests-owner" }),
      createAuthenticatedApiContext({ baseURL, prefix: "interests-other" }),
    ]);

    const update = await owner.apiContext.patch(PROFILE_PATH, {
      data: { interests: ["Astronomy"] },
    });

    expect(update.status()).toBe(200);

    const otherProfile = await other.apiContext.get(PROFILE_PATH);
    expect(otherProfile.status()).toBe(200);
    await expect(otherProfile.json()).resolves.toEqual({ interests: [] });

    const spoof = await other.apiContext.patch(PROFILE_PATH, {
      data: { interests: ["Changed"], userId: owner.user.id },
    });

    expect(spoof.status()).toBe(400);

    const ownerProfile = await owner.apiContext.get(PROFILE_PATH);
    await expect(ownerProfile.json()).resolves.toEqual({ interests: ["Astronomy"] });

    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose()]);
  });

  test("rejects malformed updates without replacing saved interests", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "interests-invalid",
    });

    const saved = await apiContext.patch(PROFILE_PATH, { data: { interests: ["Art"] } });
    expect(saved.status()).toBe(200);

    const responses = await Promise.all([
      apiContext.patch(PROFILE_PATH, { data: {} }),
      apiContext.patch(PROFILE_PATH, { data: { interests: [""] } }),
      apiContext.patch(PROFILE_PATH, { data: { interests: "Art" } }),
      apiContext.patch(PROFILE_PATH, {
        data: "{",
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(400);
    }

    const read = await apiContext.get(PROFILE_PATH);
    await expect(read.json()).resolves.toEqual({ interests: ["Art"] });
    await apiContext.dispose();
  });

  test("protects cookie mutations and supports cookie-free bearer requests", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const { apiContext, token } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "interests-auth",
    });

    const storageState = await apiContext.storageState();

    const [missingOrigin, crossOrigin, bearer] = await Promise.all([
      request.newContext({ baseURL, storageState }),
      request.newContext({
        baseURL,
        extraHTTPHeaders: { Origin: "https://attacker.example" },
        storageState,
      }),
      request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } }),
    ]);

    const [missingResponse, crossResponse] = await Promise.all([
      missingOrigin.patch(PROFILE_PATH, { data: { interests: ["Changed"] } }),
      crossOrigin.patch(PROFILE_PATH, { data: { interests: ["Changed"] } }),
    ]);

    expect(missingResponse.status()).toBe(403);
    expect(crossResponse.status()).toBe(403);

    const update = await bearer.patch(PROFILE_PATH, { data: { interests: ["Music"] } });
    expect(update.status()).toBe(200);
    const read = await apiContext.get(PROFILE_PATH);
    await expect(read.json()).resolves.toEqual({ interests: ["Music"] });

    await Promise.all([
      apiContext.dispose(),
      missingOrigin.dispose(),
      crossOrigin.dispose(),
      bearer.dispose(),
    ]);
  });
});
