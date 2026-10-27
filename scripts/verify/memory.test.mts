import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type MemorySample, judgeSoak } from "./memory.mts";

const steady = {
  documents: 1,
  heapMb: 40,
  listeners: 300,
  nodes: 4000,
  serverRssMb: 600,
} satisfies MemorySample;

/** Six laps whose heap, nodes and server memory grow by these amounts each lap. */
function laps(growth: { heapMb?: number; nodes?: number; serverRssMb?: number }): MemorySample[] {
  return Array.from({ length: 6 }, (_, index) => ({
    ...steady,
    heapMb: steady.heapMb + index * (growth.heapMb ?? 0),
    nodes: steady.nodes + index * (growth.nodes ?? 0),
    serverRssMb: steady.serverRssMb + index * (growth.serverRssMb ?? 0),
  }));
}

const soak = { laps: 6, paths: ["/today", "/plan"], production: true, sameDocument: true };

describe("judging memory over repeated laps", () => {
  it("passes memory that filled caches early, then levelled off", () => {
    const samples = [
      steady,
      { ...steady, heapMb: 60, nodes: 6000 },
      ...laps({}).map((sample) => ({ ...sample, heapMb: 60, nodes: 6000 })),
    ];

    assert.deepEqual(judgeSoak({ ...soak, laps: samples.length, samples }), []);
  });

  it("asks about memory still growing in the later laps, in the browser and on the server", () => {
    const findings = judgeSoak({
      ...soak,
      samples: laps({ heapMb: 5, nodes: 900, serverRssMb: 40 }),
    });

    assert.deepEqual(
      findings.map((finding) => finding.message.split(" kept")[0]),
      ["server memory (RSS)", "browser JS heap", "DOM nodes"],
    );
  });

  it("judges nothing on a dev server, whose tooling and compiling grow memory", () => {
    const samples = laps({ heapMb: 5, serverRssMb: 400 });
    assert.deepEqual(judgeSoak({ ...soak, production: false, samples }), []);
  });

  it("judges only the server when a lap reloaded the page, which resets the browser's memory", () => {
    const samples = laps({ heapMb: 5, nodes: 900 });
    assert.deepEqual(judgeSoak({ ...soak, sameDocument: false, samples }), []);
  });
});
