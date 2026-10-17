import { NO_SESSION_HINT, SESSION_HINT_HEADER } from "@zoonk/auth/session-hint";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tagOf } from "./_test-utils/learner-page";
import { fetchSessionTag } from "./learner-session-check";

/** Answers the session check the way Main's auth mount does: a JSON body with the hint beside it. */
function answerSessionCheck({ status = 200, tag }: { status?: number; tag: string }) {
  const response = Response.json(
    { session: null },
    { headers: { [SESSION_HINT_HEADER]: tag }, status },
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );

  return response;
}

describe(fetchSessionTag, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the answer to its end, so the check's request doesn't stay open", async () => {
    const tag = tagOf("learner");
    const response = answerSessionCheck({ tag });

    await expect(fetchSessionTag()).resolves.toBe(tag);
    expect(response.bodyUsed).toBe(true);
  });

  it("reads an error answer to its end too", async () => {
    const response = answerSessionCheck({ status: 503, tag: NO_SESSION_HINT });

    await expect(fetchSessionTag()).rejects.toThrow("503");
    expect(response.bodyUsed).toBe(true);
  });
});
