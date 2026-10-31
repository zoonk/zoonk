import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./is-same-origin-request";

function createHeaders(values: Record<string, string>) {
  return new Headers(values);
}

describe(isSameOriginRequest, () => {
  it("accepts the request host and port", () => {
    const headers = createHeaders({ host: "localhost:3210", origin: "http://localhost:3210" });

    expect(isSameOriginRequest(headers)).toBe(true);
  });

  it("uses the first forwarded host supplied by the trusted proxy", () => {
    const headers = createHeaders({
      host: "internal.example",
      origin: "https://app.zoonk.com",
      "x-forwarded-host": "app.zoonk.com, internal.example",
    });

    expect(isSameOriginRequest(headers)).toBe(true);
  });

  it.each([
    { host: "app.zoonk.com", origin: "https://attacker.example" },
    { host: "app.zoonk.com", origin: "null" },
    { host: "app.zoonk.com", origin: "not a URL" },
    { host: "", origin: "https://app.zoonk.com" },
    { host: "app.zoonk.com", origin: "" },
  ])("rejects untrusted headers %#", ({ host, origin }) => {
    expect(isSameOriginRequest(createHeaders({ host, origin }))).toBe(false);
  });
});
