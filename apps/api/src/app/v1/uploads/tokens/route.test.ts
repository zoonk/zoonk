import { createSourceUploadToken } from "@zoonk/core/library/sources/upload-token";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createUploadToken } from "./route";

// Core's integration tests cover signing, folders and allowances; this adapter test covers
// Vercel Blob's presigned-upload protocol and how each outcome maps to HTTP.
vi.mock("@zoonk/core/library/sources/upload-token", () => ({ createSourceUploadToken: vi.fn() }));

const PATHNAME = "sources/019c9bd7-bf11-73cb-9cc8-fe371298190b/edital.pdf";
const VALID_UNTIL = Date.now() + 15 * 60 * 1000;

/** A signed token shaped like the one Blob's API issues: its scope, readable, then a signature. */
function signedToken() {
  const scope = {
    operations: ["put"],
    pathname: PATHNAME,
    storeId: "private",
    validUntil: VALID_UNTIL,
  };

  return {
    clientSigningToken: "client-signing-token",
    delegationToken: `${Buffer.from(JSON.stringify(scope)).toString("base64url")}.signature`,
    validUntil: VALID_UNTIL,
  };
}

function tokenRequest(body: unknown) {
  return new NextRequest("http://localhost/v1/uploads/tokens", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

const PRESIGN_EVENT = {
  payload: { clientPayload: null, multipart: false, pathname: PATHNAME },
  type: "blob.generate-presigned-url",
};

describe("POST /v1/uploads/tokens", () => {
  beforeEach(() => {
    vi.mocked(createSourceUploadToken).mockResolvedValue({
      status: "ready",
      token: signedToken(),
      urlOptions: { addRandomSuffix: true },
    });
  });

  it("answers Vercel Blob's presign event with a signed upload of the requested file", async () => {
    const response = await createUploadToken(tokenRequest(PRESIGN_EVENT));

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      presignedUrlPayload: {
        delegationToken: signedToken().delegationToken,
        params: { "vercel-blob-add-random-suffix": "true" },
        signature: expect.any(String),
      },
      type: "blob.generate-presigned-url",
    });

    expect(createSourceUploadToken).toHaveBeenCalledWith({ pathname: PATHNAME });
  });

  it("rejects the upload-completed callback, since uploads are registered through POST /v1/uploads", async () => {
    const response = await createUploadToken(
      tokenRequest({ payload: { blob: {} }, type: "blob.upload-completed" }),
    );

    expect(response.status).toBe(400);
    expect(createSourceUploadToken).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "unauthorized" as const }, 401, "UNAUTHORIZED"],
    [{ status: "invalidPathname" as const }, 400, "BAD_REQUEST"],
    [{ limit: 3, status: "limitReached" as const }, 429, "UPLOAD_LIMIT_REACHED"],
  ])("maps %o to HTTP %i", async (result, status, code) => {
    vi.mocked(createSourceUploadToken).mockResolvedValue(result);

    const response = await createUploadToken(tokenRequest(PRESIGN_EVENT));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });
});
