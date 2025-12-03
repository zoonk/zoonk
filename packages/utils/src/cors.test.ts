import { describe, expect, test } from "vitest";
import { isAllowedOrigin } from "./cors";

describe("isAllowedOrigin", () => {
  test("allows exact origin match", () => {
    const trustedOrigins = [
      "https://appleid.apple.com",
      "http://localhost:3000",
      "https://zoonk.com",
    ];

    expect(isAllowedOrigin("https://appleid.apple.com", trustedOrigins)).toBe(
      true,
    );

    expect(isAllowedOrigin("http://appleid.apple.com", trustedOrigins)).toBe(
      false,
    );

    expect(isAllowedOrigin("http://localhost:3000", trustedOrigins)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3001", trustedOrigins)).toBe(
      false,
    );

    expect(isAllowedOrigin("https://zoonk.com", trustedOrigins)).toBe(true);
    expect(isAllowedOrigin("https://notzoonk.com", trustedOrigins)).toBe(false);
  });

  test("allows wildcard subdomain match", () => {
    const trustedOrigins = ["https://*.zoonk.com"];

    expect(isAllowedOrigin("https://sub.zoonk.com", trustedOrigins)).toBe(true);

    expect(isAllowedOrigin("https://deep.sub.zoonk.com", trustedOrigins)).toBe(
      true,
    );

    expect(isAllowedOrigin("https://zoonk.com", trustedOrigins)).toBe(false);
  });

  test("allows vercel preview deployment patterns", () => {
    const trustedOrigins = ["*-zoonk.vercel.app"];

    expect(
      isAllowedOrigin("https://zoonk-feature-zoonk.vercel.app", trustedOrigins),
    ).toBe(true);

    expect(
      isAllowedOrigin("https://branch-name-zoonk.vercel.app", trustedOrigins),
    ).toBe(true);

    expect(
      isAllowedOrigin("https://pr-123-zoonk.vercel.app", trustedOrigins),
    ).toBe(true);

    expect(isAllowedOrigin("https://zoonk.vercel.app", trustedOrigins)).toBe(
      false,
    );

    expect(
      isAllowedOrigin("https://evil-zoonk.vercel.app.evil.com", trustedOrigins),
    ).toBe(false);
  });

  test("handles empty allowed origins array", () => {
    expect(isAllowedOrigin("https://zoonk.com", [])).toBe(false);
  });

  describe("edge cases", () => {
    test("handles empty allowed origins array", () => {
      expect(isAllowedOrigin("https://zoonk.com", [])).toBe(false);
    });

    test("is case-insensitive", () => {
      const trustedOrigins = ["https://zoonk.com"];

      expect(isAllowedOrigin("https://ZOONK.COM", trustedOrigins)).toBe(true);
      expect(isAllowedOrigin("HTTPS://zoonk.com", trustedOrigins)).toBe(true);
    });
  });
});
