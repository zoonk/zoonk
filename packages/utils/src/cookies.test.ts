import { afterEach, describe, expect, it, vi } from "vitest";
import { setCookie } from "./cookies";

/**
 * Provides the initial resolver value before the Promise constructor replaces
 * it with the actual resolver for the controlled write promise.
 */
function noop(): void {}

/**
 * Creates a document-like object that records cookie assignments so the
 * fallback branch can be tested without a browser environment.
 */
function createDocumentCookieStub(writtenCookies: string[]): { cookie: string } {
  const documentStub = {};

  Object.defineProperty(documentStub, "cookie", {
    configurable: true,
    get: () => writtenCookies.at(-1) ?? "",
    set: (value: string) => writtenCookies.push(value),
  });

  return documentStub as { cookie: string };
}

/**
 * Creates a promise whose resolution is controlled by the test so we can prove
 * `setCookie` waits for Cookie Store API writes before it resolves.
 */
function createDeferredWrite(): { promise: Promise<void>; resolve: () => void } {
  let resolveWrite = noop;

  const promise = new Promise<void>((resolve) => {
    resolveWrite = resolve;
  });

  return { promise, resolve: resolveWrite };
}

describe(setCookie, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("awaits Cookie Store API writes when the browser supports it", async () => {
    const now = new Date("2026-05-06T00:00:00.000Z");

    vi.useFakeTimers();
    vi.setSystemTime(now);

    const write = createDeferredWrite();
    const set = vi.fn(() => write.promise);
    const completedWrites: string[] = [];

    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("cookieStore", { set });

    const cookieWrite = setCookie("session", "abc123", { maxAge: 60, sameSite: "strict" });
    void cookieWrite.then(() => completedWrites.push("done"));

    await Promise.resolve();

    expect(set).toHaveBeenCalledWith({
      expires: now.getTime() + 60 * 1000,
      name: "session",
      path: "/",
      sameSite: "strict",
      value: "abc123",
    });

    expect(completedWrites).toStrictEqual([]);

    write.resolve();
    await cookieWrite;

    expect(completedWrites).toStrictEqual(["done"]);
  });

  it("falls back to document.cookie when the Cookie Store API is unavailable", async () => {
    const writtenCookies: string[] = [];

    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("document", createDocumentCookieStub(writtenCookies));

    await setCookie("login state", "value with spaces", {
      maxAge: 60,
      path: "/auth",
      sameSite: "none",
    });

    expect(writtenCookies).toStrictEqual([
      "login%20state=value%20with%20spaces; max-age=60; path=/auth; samesite=none",
    ]);
  });

  it("does not use Cookie Store API in insecure contexts", async () => {
    const set = vi.fn();
    const writtenCookies: string[] = [];

    vi.stubGlobal("cookieStore", { set });
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("document", createDocumentCookieStub(writtenCookies));

    await setCookie("session", "abc123");

    expect(set).not.toHaveBeenCalled();
    expect(writtenCookies).toStrictEqual(["session=abc123; path=/; samesite=lax"]);
  });
});
