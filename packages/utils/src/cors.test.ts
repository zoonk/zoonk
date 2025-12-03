import { describe, expect, test } from "vitest";
import { isOriginAllowed } from "./cors";

describe("isOriginAllowed", () => {
  test("allows exact origin match", () => {
    const trustedOrigins = [
      "https://appleid.apple.com",
      "http://localhost:3000",
      "https://zoonk.com",
    ];

    expect(isOriginAllowed("https://appleid.apple.com", trustedOrigins)).toBe(
      true,
    );

    expect(isOriginAllowed("http://appleid.apple.com", trustedOrigins)).toBe(
      false,
    );

    expect(isOriginAllowed("http://localhost:3000", trustedOrigins)).toBe(true);
    expect(isOriginAllowed("http://localhost:3001", trustedOrigins)).toBe(
      false,
    );

    expect(isOriginAllowed("https://zoonk.com", trustedOrigins)).toBe(true);
    expect(isOriginAllowed("https://notzoonk.com", trustedOrigins)).toBe(false);
  });

  test("allows wildcard subdomain match", () => {
    const trustedOrigins = ["https://*.zoonk.com"];

    expect(isOriginAllowed("https://sub.zoonk.com", trustedOrigins)).toBe(true);

    expect(isOriginAllowed("https://deep.sub.zoonk.com", trustedOrigins)).toBe(
      true,
    );

    expect(isOriginAllowed("https://zoonk.com", trustedOrigins)).toBe(false);
  });

  test("allows vercel preview deployment patterns", () => {
    const trustedOrigins = ["*-zoonk.vercel.app"];

    expect(
      isOriginAllowed("https://zoonk-feature-zoonk.vercel.app", trustedOrigins),
    ).toBe(true);

    expect(
      isOriginAllowed("https://branch-name-zoonk.vercel.app", trustedOrigins),
    ).toBe(true);

    expect(
      isOriginAllowed("https://pr-123-zoonk.vercel.app", trustedOrigins),
    ).toBe(true);

    expect(isOriginAllowed("https://zoonk.vercel.app", trustedOrigins)).toBe(
      false,
    );

    expect(
      isOriginAllowed("https://evil-zoonk.vercel.app.evil.com", trustedOrigins),
    ).toBe(false);
  });

  test("handles empty allowed origins array", () => {
    expect(isOriginAllowed("https://zoonk.com", [])).toBe(false);
  });

  describe("edge cases", () => {
    test("handles empty allowed origins array", () => {
      expect(isOriginAllowed("https://zoonk.com", [])).toBe(false);
    });

    test("is case-insensitive", () => {
      const trustedOrigins = ["https://zoonk.com"];

      expect(isOriginAllowed("https://ZOONK.COM", trustedOrigins)).toBe(true);
      expect(isOriginAllowed("HTTPS://zoonk.com", trustedOrigins)).toBe(true);
    });
  });
});
