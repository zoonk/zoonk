import { describe, expect, it } from "vitest";
import { getSessionCookieName, hasSessionCookie } from "./cookies";

describe(getSessionCookieName, () => {
  it.each([
    { expected: "better-auth.session_token", secure: false },
    { expected: "__Secure-better-auth.session_token", secure: true },
  ])("resolves the session cookie name when secure is $secure", ({ expected, secure }) => {
    expect(getSessionCookieName({ secure })).toBe(expected);
  });
});

/** A request's cookies holding these names. */
function store(names: string[]) {
  return { has: (name: string) => names.includes(name) };
}

describe(hasSessionCookie, () => {
  it("finds a session cookie by either name", () => {
    expect(hasSessionCookie(store(["better-auth.session_token"]))).toBe(true);
    expect(hasSessionCookie(store(["__Secure-better-auth.session_token"]))).toBe(true);
    expect(hasSessionCookie(store(["NEXT_LOCALE"]))).toBe(false);
  });
});
