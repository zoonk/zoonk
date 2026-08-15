import { describe, expect, it } from "vitest";
import { getSessionCookieName } from "./cookies";

describe(getSessionCookieName, () => {
  it.each([
    { expected: "better-auth.session_token", secure: false },
    { expected: "__Secure-better-auth.session_token", secure: true },
  ])("resolves the session cookie name when secure is $secure", ({ expected, secure }) => {
    expect(getSessionCookieName({ secure })).toBe(expected);
  });
});
