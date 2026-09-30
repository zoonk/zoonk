import { issueSignedToken } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { createSourceUploadToken, isOwnUploadPathname } from "./create-upload-token";
import { MAX_SOURCE_UPLOAD_BYTES, SOURCE_UPLOAD_CONTENT_TYPES } from "./source-contract";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

// The signed token comes from Vercel Blob's API, an external service.
vi.mock("@vercel/blob", () => ({ issueSignedToken: vi.fn() }));

const SIGNED_TOKEN = {
  clientSigningToken: "client-signing-token",
  delegationToken: "delegation-token",
  validUntil: Date.now(),
};

describe(createSourceUploadToken, () => {
  beforeEach(() => {
    mockSession(null);
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "store_private");
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "");
    vi.mocked(issueSignedToken).mockResolvedValue(SIGNED_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires a signed-in learner", async () => {
    await expect(
      createSourceUploadToken({ pathname: "sources/x/file.pdf" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("signs one upload to the learner's folder in the private store, for the supported types and size", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const pathname = `sources/${user.id}/edital.pdf`;

    await expect(createSourceUploadToken({ pathname })).resolves.toStrictEqual({
      status: "ready",
      token: SIGNED_TOKEN,
      urlOptions: { addRandomSuffix: true },
    });

    expect(issueSignedToken).toHaveBeenCalledExactlyOnceWith({
      allowedContentTypes: [...SOURCE_UPLOAD_CONTENT_TYPES],
      maximumSizeInBytes: MAX_SOURCE_UPLOAD_BYTES,
      operations: ["put"],
      pathname,
      storeId: "store_private",
      token: undefined,
      validUntil: expect.any(Number),
    });

    expect(vi.mocked(issueSignedToken).mock.calls[0]?.[0].validUntil).toBeGreaterThan(Date.now());
  });

  it("refuses another learner's folder", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    mockSession(user.id);

    await expect(
      createSourceUploadToken({ pathname: `sources/${other.id}/edital.pdf` }),
    ).resolves.toStrictEqual({ status: "invalidPathname" });

    expect(issueSignedToken).not.toHaveBeenCalled();
  });

  it("refuses once today's uploads are used up", async () => {
    const user = await userFixture();
    await usageRecordsFixture({ count: 3, kind: "upload", userId: user.id });
    mockSession(user.id);

    await expect(
      createSourceUploadToken({ pathname: `sources/${user.id}/edital.pdf` }),
    ).resolves.toStrictEqual({ limit: 3, status: "limitReached" });
  });

  it("doesn't count yesterday's uploads or other usage", async () => {
    const user = await userFixture();
    const yesterday = new Date(Date.now() - 86_400_000 * 2);

    await Promise.all([
      usageRecordsFixture({ count: 3, createdAt: yesterday, kind: "upload", userId: user.id }),
      usageRecordsFixture({ count: 5, kind: "lessonStart", userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(
      createSourceUploadToken({ pathname: `sources/${user.id}/edital.pdf` }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("refuses guests, whose plan has no uploads", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    mockGuestSession(guest.id);

    await expect(
      createSourceUploadToken({ pathname: `sources/${guest.id}/edital.pdf` }),
    ).resolves.toStrictEqual({ limit: 0, status: "limitReached" });
  });
});

describe(isOwnUploadPathname, () => {
  it("accepts a file in the learner's folder only", () => {
    expect(isOwnUploadPathname({ pathname: "sources/user-1/a.pdf", userId: "user-1" })).toBe(true);
    expect(isOwnUploadPathname({ pathname: "sources/user-1/", userId: "user-1" })).toBe(false);

    expect(
      isOwnUploadPathname({ pathname: "sources/user-1/../user-2/a.pdf", userId: "user-1" }),
    ).toBe(false);

    expect(isOwnUploadPathname({ pathname: "sources/user-10/a.pdf", userId: "user-1" })).toBe(
      false,
    );

    expect(isOwnUploadPathname({ pathname: "sources/user-1/notes/a.pdf", userId: "user-1" })).toBe(
      false,
    );
  });
});
