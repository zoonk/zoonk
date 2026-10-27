import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type MemorySample, judgeSoak } from "./memory.mts";

const steady: MemorySample = {
  documents: 1,
  heapMb: 40,
  listeners: 300,
  nodes: 4000,
  serverRssMb: 600,
};

describe("judging memory over repeated laps", () => {
  it("passes memory that levels off after the first lap", () => {
    const last = { ...steady, heapMb: 41, nodes: 4100, serverRssMb: 610 };

    assert.deepEqual(
      judgeSoak({ first: steady, laps: 10, last, paths: ["/today", "/plan"], production: true }),
      [],
    );
  });

  it("asks about memory that grows every lap, in the browser and on the server", () => {
    const last = { ...steady, heapMb: 70, nodes: 9000, serverRssMb: 800 };

    const findings = judgeSoak({
      first: steady,
      laps: 6,
      last,
      paths: ["/today", "/plan"],
      production: true,
    });

    assert.deepEqual(
      findings.map((finding) => finding.message.split(" grew")[0]),
      ["server memory (RSS)", "browser JS heap", "DOM nodes kept"],
    );
  });

  it("judges nothing on a dev server, whose tooling and compiling grow memory", () => {
    const last = { ...steady, heapMb: 90, serverRssMb: 3000 };

    assert.deepEqual(
      judgeSoak({ first: steady, laps: 6, last, paths: ["/today", "/plan"], production: false }),
      [],
    );
  });

  it("judges only the server when one path reloads itself, since each reload starts a new page", () => {
    const last = { ...steady, heapMb: 70, serverRssMb: 601 };

    assert.deepEqual(
      judgeSoak({ first: steady, laps: 6, last, paths: ["/today"], production: true }),
      [],
    );
  });
});
