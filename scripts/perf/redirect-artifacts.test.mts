import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { getRedirectProblems } from "./redirect-artifacts.mts";

describe("persisted redirect HTTP and client navigation agreement", () => {
  it.each([
    {
      location: "https://blog.zoonk.com",
      status: 307,
      target: "https://blog.zoonk.com",
      valid: true,
    },
    { location: "/en/pricing/USD", status: 308, target: "/en/pricing/USD", valid: true },
    { location: "/en/pricing/USD", status: 302, target: "/en/pricing/USD", valid: false },
    { location: "/wrong", status: 307, target: "https://blog.zoonk.com", valid: false },
    {
      location: "data:text/plain,invalid",
      status: 307,
      target: "data:text/plain,invalid",
      valid: false,
    },
  ])("validates $status to $target", ({ location, status, target, valid }) => {
    const problems = getRedirectProblems({
      flight: `1:E${JSON.stringify({ digest: `NEXT_REDIRECT;replace;${target};${status};` })}\n`,
      meta: { headers: { location }, status },
    });

    assert.equal(problems.length === 0, valid);
  });

  it("rejects an HTTP redirect missing from the client response", () => {
    assert.deepEqual(
      getRedirectProblems({
        flight: '1:E{"digest":"OTHER_ERROR"}\n',
        meta: { headers: { location: "/en" }, status: 307 },
      }),
      ["redirect missing from RSC"],
    );
  });

  it("rejects status disagreement between HTTP and RSC", () => {
    assert.deepEqual(
      getRedirectProblems({
        flight: '1:E{"digest":"NEXT_REDIRECT;push;/en;308;"}\n',
        meta: { headers: { location: "/en" }, status: 307 },
      }),
      ["redirect status differs from RSC"],
    );
  });
});
