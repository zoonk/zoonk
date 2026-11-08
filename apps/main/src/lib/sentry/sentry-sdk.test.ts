import { type ErrorEvent, type EventHint, init } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startSentry } from "./sentry-sdk";

/** The SDK sends to Sentry's servers. */
vi.mock("@sentry/nextjs", () => ({ httpClientIntegration: vi.fn(), init: vi.fn() }));

function httpClientError({
  headers,
  method,
}: {
  headers: Record<string, string>;
  method: string;
}): ErrorEvent {
  return {
    contexts: { response: { headers, status_code: 429 } },
    exception: {
      values: [{ mechanism: { handled: false, type: "auto.http.client.fetch" }, type: "Error" }],
    },
    request: { method, url: "https://www.zoonk.com/start/goal" },
    type: undefined,
  };
}

function send(event: ErrorEvent): ErrorEvent | null {
  startSentry();
  const beforeSend = vi.mocked(init).mock.calls[0]?.[0].beforeSend;

  if (!beforeSend) {
    throw new Error("startSentry set no beforeSend");
  }

  const hint: EventHint = {};
  return beforeSend(event, hint) as ErrorEvent | null;
}

describe("Sentry in the browser", () => {
  beforeEach(() => {
    vi.mocked(init).mockClear();
  });

  it("reports a write the firewall stopped", () => {
    const event = httpClientError({
      headers: { "x-vercel-mitigated": "challenge" },
      method: "POST",
    });

    expect(send(event)).toBe(event);
  });

  it("leaves out refusals the app sent itself", () => {
    expect(send(httpClientError({ headers: {}, method: "POST" }))).toBeNull();
  });

  it("leaves out reads the firewall stopped", () => {
    expect(
      send(httpClientError({ headers: { "x-vercel-mitigated": "challenge" }, method: "GET" })),
    ).toBeNull();
  });

  it("keeps reporting thrown errors", () => {
    const event: ErrorEvent = {
      exception: { values: [{ type: "TypeError", value: "x is undefined" }] },
      type: undefined,
    };

    expect(send(event)).toBe(event);
  });
});
