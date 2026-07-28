import { describe, expect, it, vi } from "vitest";
import { SECURITY_SCHEMES } from "./security";

vi.mock("@zoonk/utils/environment", () => ({ isLocalhostSupported: () => false }));

describe("OpenAPI security schemes", () => {
  it("documents the secure Better Auth cookie name outside localhost environments", () => {
    expect(SECURITY_SCHEMES.cookieAuth).toMatchObject({
      in: "cookie",
      name: "__Secure-better-auth.session_token",
      type: "apiKey",
    });
  });
});
