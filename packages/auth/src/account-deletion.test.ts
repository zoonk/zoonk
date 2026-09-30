import { randomUUID } from "node:crypto";
import { del, list } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAccountDeletionCleanup,
  deleteUserDependenciesBeforeAuthDelete,
} from "./account-deletion";

const APPLE_PROVIDER_ID = "apple";

const mocks = vi.hoisted(() => ({
  cancelStripeSubscription: vi.fn(),
  revokeStoredAppleAuthorization: vi.fn(),
}));

vi.mock("./providers/apple-revocation", () => ({
  revokeStoredAppleAuthorization: mocks.revokeStoredAppleAuthorization,
}));

/** Vercel Blob is the external storage the learner's uploads and recordings live in. */
vi.mock("@vercel/blob", () => ({ del: vi.fn(), list: vi.fn() }));

vi.mock("./stripe/client", () => ({
  stripeClient: { subscriptions: { cancel: mocks.cancelStripeSubscription } },
}));

/**
 * Creates an isolated persisted user so cleanup assertions exercise the same
 * foreign keys and cascades as production instead of reproducing Prisma in a mock.
 */
function createTestUser() {
  const id = randomUUID();

  return prisma.user.create({
    data: { email: `account-deletion-${id}@example.test`, id, name: "Deletion Test User" },
  });
}

describe(deleteUserDependenciesBeforeAuthDelete, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cancelStripeSubscription.mockResolvedValue({ id: "sub_active" });
    mocks.revokeStoredAppleAuthorization.mockResolvedValue(true);
  });

  it("removes local subscription records", async () => {
    const user = await createTestUser();

    const subscription = await prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "plus",
        provider: "zoonk",
        referenceId: user.id,
        status: "active",
      },
    });

    await deleteUserDependenciesBeforeAuthDelete(user);

    await expect(
      prisma.subscription.findUnique({ where: { id: subscription.id } }),
    ).resolves.toBeNull();
  });

  it("cancels Stripe billing before removing the local subscription", async () => {
    const user = await createTestUser();

    const subscription = await prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "active",
        stripeSubscriptionId: `sub_${randomUUID()}`,
      },
    });

    mocks.cancelStripeSubscription.mockImplementationOnce(async () => {
      await expect(
        prisma.subscription.findUnique({ where: { id: subscription.id } }),
      ).resolves.not.toBeNull();

      return { id: subscription.stripeSubscriptionId };
    });

    await deleteUserDependenciesBeforeAuthDelete(user);

    expect(mocks.cancelStripeSubscription).toHaveBeenCalledExactlyOnceWith(
      subscription.stripeSubscriptionId,
    );

    await expect(
      prisma.subscription.findUnique({ where: { id: subscription.id } }),
    ).resolves.toBeNull();
  });

  it("attempts stored Apple revocation before removing local account state", async () => {
    const user = await createTestUser();
    const normalizedEmail = user.email.toLowerCase();

    const verificationIdentifiers = [
      `email-verification-otp-${normalizedEmail}`,
      `sign-in-otp-${normalizedEmail}`,
      `forget-password-otp-${normalizedEmail}`,
    ];

    await Promise.all([
      prisma.account.create({
        data: {
          accountId: `apple-${randomUUID()}`,
          idToken: "stored-id-token",
          providerId: APPLE_PROVIDER_ID,
          refreshToken: "stored-refresh-token",
          userId: user.id,
        },
      }),
      prisma.verification.createMany({
        data: verificationIdentifiers.map((identifier) => ({
          expiresAt: new Date(Date.now() + 60_000),
          identifier,
          value: "123456",
        })),
      }),
    ]);

    mocks.revokeStoredAppleAuthorization.mockImplementationOnce(async () => {
      await expect(
        prisma.verification.count({ where: { identifier: { in: verificationIdentifiers } } }),
      ).resolves.toBe(3);

      return false;
    });

    const cleanup = await captureAccountDeletionCleanup(async () => {
      await deleteUserDependenciesBeforeAuthDelete(user);
      return "deleted" as const;
    });

    expect(cleanup).toStrictEqual({ appleAuthorizationRevoked: false, result: "deleted" });

    expect(mocks.revokeStoredAppleAuthorization).toHaveBeenCalledExactlyOnceWith({
      idToken: "stored-id-token",
      refreshToken: "stored-refresh-token",
    });

    await expect(
      prisma.verification.count({ where: { identifier: { in: verificationIdentifiers } } }),
    ).resolves.toBe(0);
  });
});

/** One page of files in the private store, as Blob lists them. */
function listed({ cursor, urls }: { cursor?: string; urls: string[] }) {
  return {
    blobs: urls.map((url) => ({ url })),
    cursor,
    folders: [],
    hasMore: Boolean(cursor),
  } as never;
}

describe("deleting a learner's private files", () => {
  const PRIVATE_STORE = { storeId: "store_private", token: undefined };

  beforeEach(() => {
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", PRIVATE_STORE.storeId);
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deletes every upload and private course picture in the learner's folders, page by page, before anything else", async () => {
    const user = await createTestUser();

    vi.mocked(list).mockImplementation(async ({ cursor, prefix } = {}) => {
      if (prefix === `sources/${user.id}/`) {
        return cursor
          ? listed({ urls: ["https://blob.test/sources/b.pdf"] })
          : listed({ cursor: "next", urls: ["https://blob.test/sources/a.pdf"] });
      }

      return listed({ urls: [`https://blob.test/images/${user.id}/step.webp`] });
    });

    await deleteUserDependenciesBeforeAuthDelete(user);

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: `images/${user.id}/`, ...PRIVATE_STORE }),
    );

    expect(del).toHaveBeenCalledWith(["https://blob.test/sources/a.pdf"], PRIVATE_STORE);
    expect(del).toHaveBeenCalledWith(["https://blob.test/sources/b.pdf"], PRIVATE_STORE);

    expect(del).toHaveBeenCalledWith(
      [`https://blob.test/images/${user.id}/step.webp`],
      PRIVATE_STORE,
    );

    expect(vi.mocked(del).mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cancelStripeSubscription.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("keeps an upload its publisher made public, which every learner now shares", async () => {
    const user = await createTestUser();
    const sharedUrl = `https://blob.test/sources/${user.id}/notice-${randomUUID()}.pdf`;
    const ownUrl = `https://blob.test/sources/${user.id}/notes-${randomUUID()}.pdf`;

    await prisma.source.create({
      data: {
        blobUrl: sharedUrl,
        contentHash: randomUUID(),
        fetchedAt: new Date(),
        identityKey: randomUUID(),
        kind: "upload",
        language: "pt",
        title: "Edital",
        visibility: "public",
      },
    });

    vi.mocked(list).mockImplementation(async ({ prefix } = {}) =>
      listed({ urls: prefix === `sources/${user.id}/` ? [sharedUrl, ownUrl] : [] }),
    );

    await deleteUserDependenciesBeforeAuthDelete(user);

    expect(del).toHaveBeenCalledExactlyOnceWith([ownUrl], PRIVATE_STORE);
  });

  it("deletes the pictures of a private course that came from their guest, still in the guest's folder", async () => {
    const user = await createTestUser();
    const id = randomUUID();
    const movedUrl = `https://blob.test/images/${randomUUID()}/step-${id}.webp`;
    vi.mocked(list).mockResolvedValue(listed({ urls: [] }));

    await prisma.mediaAsset.create({
      data: {
        kind: "image",
        model: "test-model",
        ownerId: user.id,
        promptVersion: "test",
        reuseKey: `private:${user.id}:image:${id}`,
        runId: `test-run-${id}`,
        url: movedUrl,
        visibility: "private",
      },
    });

    await deleteUserDependenciesBeforeAuthDelete(user);

    expect(del).toHaveBeenCalledExactlyOnceWith([movedUrl], PRIVATE_STORE);
  });

  it("has nothing to delete where no private store was ever configured", async () => {
    const user = await createTestUser();
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "");

    await deleteUserDependenciesBeforeAuthDelete(user);

    expect(list).not.toHaveBeenCalled();
  });

  it("stops the deletion when the files can't be deleted, so a retry finishes it", async () => {
    const user = await createTestUser();
    vi.mocked(list).mockRejectedValue(new Error("Blob unavailable"));

    await expect(deleteUserDependenciesBeforeAuthDelete(user)).rejects.toThrow("Blob unavailable");
    expect(mocks.revokeStoredAppleAuthorization).not.toHaveBeenCalled();
  });
});
