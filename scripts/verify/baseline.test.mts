import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { compareWithBaseline } from "./baseline.mts";

const BEFORE = { lcpMs: 1500, scripts: 500_000, serverCpuMs: 400 };

function load(
  path: string,
  overrides: { lcpMs?: number; scripts?: number; serverCpuMs?: number } = {},
) {
  return {
    blockingMs: 100,
    bytes: { html: 20_000, scripts: overrides.scripts ?? BEFORE.scripts, total: 900_000 },
    fcpMs: 900,
    lcpMs: overrides.lcpMs ?? BEFORE.lcpMs,
    path,
    production: true,
    screenshots: [],
    serverCpuMs: overrides.serverCpuMs ?? BEFORE.serverCpuMs,
    shifts: [],
    viewport: "phone" as const,
  };
}

describe("comparing a run with its baseline", () => {
  it("ignores noise: small moves and moves within a page's usual share", () => {
    const { findings } = compareWithBaseline(
      [load("/today")],
      [load("/today", { lcpMs: 1580, serverCpuMs: 440 })],
    );

    assert.deepEqual(findings, []);
  });

  it("names what got clearly worse, by each page's median across its screens", () => {
    const { findings, rows } = compareWithBaseline(
      [load("/today"), load("/today")],
      [
        load("/today", { lcpMs: 2100, scripts: 600_000 }),
        load("/today", { lcpMs: 2000, scripts: 600_000 }),
      ],
    );

    assert.deepEqual(
      findings.map(({ finding }) => finding.message.split(":")[0]),
      ["LCP got worse", "JS got worse"],
    );

    assert.equal(rows[0]?.[1], "1500 ms → 2000 ms");
  });
});
