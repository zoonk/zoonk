import { randomUUID } from "node:crypto";
import { issueSignedToken } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { isUuid } from "@zoonk/utils/uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import {
  createSourceUploadToken,
  getUploadClaimId,
  isOwnUploadPathname,
} from "./create-upload-token";
import { MAX_SOURCE_UPLOAD_BYTES, SOURCE_UPLOAD_CONTENT_TYPES } from "./source-contract";

/** A file the learner names for upload: its own id first, as the apps name them. */
function uploadPathname(userId: string) {
  return `sources/${userId}/${randomUUID()}-edital.pdf`;
}

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
    vi.useRealTimers();
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
      urlOptions: { addRandomSuffix: false, allowOverwrite: false },
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

  // A file stored without being registered takes storage all the same, so signing is what counts.
  it("counts each signed file, so a free account can't sign more uploads than its plan allows", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const firstPathname = uploadPathname(user.id);
    const pathnames = [firstPathname, uploadPathname(user.id), uploadPathname(user.id)];

    const signed = await Promise.all(
      pathnames.map((pathname) => createSourceUploadToken({ pathname })),
    );

    expect(signed.map((result) => result.status)).toStrictEqual(["ready", "ready", "ready"]);

    await expect(
      createSourceUploadToken({ pathname: uploadPathname(user.id) }),
    ).resolves.toStrictEqual({
      limit: { limit: 3, period: "day", resource: "upload", tier: "free" },
      status: "limitReached",
    });

    // Signing a path again stores no second file there, so it counts nothing more.
    await expect(createSourceUploadToken({ pathname: firstPathname })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(
      prisma.usageRecord.count({ where: { kind: "upload", userId: user.id } }),
    ).resolves.toBe(3);

    expect(issueSignedToken).toHaveBeenCalledTimes(4);
  });

  it("refuses another learner's folder", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    mockSession(user.id);

    await expect(
      createSourceUploadToken({ pathname: `sources/${other.id}/edital.pdf` }),
    ).resolves.toStrictEqual({ status: "invalidPathname" });

    expect(issueSignedToken).not.toHaveBeenCalled();
  });

  it("refuses once today's or this month's uploads are used up, saying which", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    const [today, thisMonth] = await Promise.all([userFixture(), userFixture()]);
    const earlierThisMonth = new Date("2026-10-02T12:00:00Z");

    await Promise.all([
      usageRecordsFixture({ count: 3, kind: "upload", userId: today.id }),
      usageRecordsFixture({
        count: 10,
        createdAt: earlierThisMonth,
        kind: "upload",
        userId: thisMonth.id,
      }),
    ]);

    mockSession(today.id);

    await expect(
      createSourceUploadToken({ pathname: `sources/${today.id}/edital.pdf` }),
    ).resolves.toStrictEqual({
      limit: { limit: 3, period: "day", resource: "upload", tier: "free" },
      status: "limitReached",
    });

    mockSession(thisMonth.id);

    await expect(
      createSourceUploadToken({ pathname: `sources/${thisMonth.id}/edital.pdf` }),
    ).resolves.toMatchObject({ limit: { period: "month", tier: "free" }, status: "limitReached" });

    expect(issueSignedToken).not.toHaveBeenCalled();
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
    ).resolves.toStrictEqual({
      limit: { limit: 0, period: "total", resource: "upload", tier: "guest" },
      status: "limitReached",
    });
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

describe(getUploadClaimId, () => {
  // It's also the id of the source the file becomes, which API clients send back.
  it("names each path's claim with a valid UUID, the same one every time", () => {
    const claim = getUploadClaimId("sources/user-1/a.pdf");

    expect(isUuid(claim)).toBe(true);
    expect(getUploadClaimId("sources/user-1/a.pdf")).toBe(claim);
    expect(getUploadClaimId("sources/user-1/b.pdf")).not.toBe(claim);
  });
});
