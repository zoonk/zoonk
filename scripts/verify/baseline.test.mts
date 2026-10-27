import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { compareWithBaseline } from "./baseline.mts";

const BEFORE = { lcpMs: 1500, scripts: 500_000, serverCpuMs: 400 };

function load(
  path: string,
  overrides: {
    lcpMs?: number;
    scripts?: number;
    serverCpuMs?: number;
    viewport?: "laptop" | "phone";
  } = {},
) {
  return {
    blockingMs: 100,
    bytes: { html: 20_000, scripts: overrides.scripts ?? BEFORE.scripts, total: 900_000 },
    fcpMs: 900,
    lcpMs: overrides.lcpMs ?? BEFORE.lcpMs,
    mainThreadMs: 300,
    path,
    production: true,
    screenshots: [],
    serverCpuMs: overrides.serverCpuMs ?? BEFORE.serverCpuMs,
    shifts: [],
    viewport: overrides.viewport ?? "phone",
  };
}

describe("comparing a run with its baseline", () => {
  it("judges nothing against a baseline measured with other throttling", () => {
    const { findings } = compareWithBaseline([load("/today")], [load("/today", { lcpMs: 4000 })], {
      sameSettings: false,
    });

    assert.deepEqual(findings, []);
  });

  it("ignores noise: small moves and moves within a page's usual share", () => {
    const { findings } = compareWithBaseline(
      [load("/today")],
      [load("/today", { lcpMs: 1580, serverCpuMs: 440 })],
      { sameSettings: true },
    );

    assert.deepEqual(findings, []);
  });

  it("names what got clearly worse on each screen, so the phone alone isn't averaged away", () => {
    const { findings, rows } = compareWithBaseline(
      [load("/today"), load("/today", { viewport: "laptop" })],
      [load("/today", { lcpMs: 2100, scripts: 600_000 }), load("/today", { viewport: "laptop" })],
      { sameSettings: true },
    );

    assert.deepEqual(
      findings.map(({ finding, viewport }) => `${viewport} ${finding.message.split(":")[0]}`),
      ["phone LCP got worse", "phone JS got worse"],
    );

    assert.equal(rows[0]?.[2], "1500 ms → 2100 ms");
  });
});
