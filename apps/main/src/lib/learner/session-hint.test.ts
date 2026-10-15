import { httpHeadersToSpanAttributes } from "@sentry/nextjs";
import { SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { describe, expect, it } from "vitest";

/** A made-up learner's tag: it names one learner across all their sessions. */
const TAG = "t1.AbCdEfGhIjKlMnOpQrSt-_";

describe("session hint in telemetry", () => {
  it("never records the learner's tag from a request's cookies or a response's Set-Cookie", () => {
    // As the SDK resolves our policy: options it doesn't set (queues) don't touch cookies.
    const dataCollection = { ...getSentryDataCollection(), queues: false };

    const recorded = [
      httpHeadersToSpanAttributes(
        { cookie: `${SESSION_HINT_COOKIE}=${TAG}; theme=dark` },
        dataCollection,
        "request",
      ),
      httpHeadersToSpanAttributes(
        { "set-cookie": `${SESSION_HINT_COOKIE}=${TAG}; Path=/; SameSite=Lax` },
        dataCollection,
        "response",
      ),
    ];

    expect(JSON.stringify(recorded)).not.toContain(TAG);
    expect(JSON.stringify(recorded)).toContain("theme=dark");
  });
});
