import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Exposure, describeExposures } from "./dependencies.mts";

const advisory = {
  findings: [],
  id: 1_116_904,
  module_name: "zod",
  severity: "high",
  title: "Zod can exhaust memory",
  url: "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
};

function exposure({ path, version }: { path: string; version: string }): Exposure {
  return { advisory, path, version };
}

const isNew = (lines: string[]) => lines.some((line) => line.includes("**must fix**"));

describe("which vulnerable dependencies a change brings in", () => {
  it("doesn't blame the change when the audit samples other paths to a version the base had", () => {
    const before = [exposure({ path: "api>workflow>@workflow/core>zod", version: "4.5.4" })];
    const now = [exposure({ path: "api>workflow>@workflow/errors>zod", version: "4.5.4" })];

    assert.equal(isNew(describeExposures({ before, now })), false);
  });

  it("blames the change for a version the base's production install didn't have", () => {
    const before = [exposure({ path: "auth>better-auth>zod", version: "4.6.5" })];
    const now = [...before, exposure({ path: "api>workflow>zod", version: "4.5.4" })];

    const lines = describeExposures({ before, now });

    assert.equal(lines.length, 2);
    assert.ok(lines.some((line) => line.includes("**must fix**") && line.includes("zod@4.5.4")));
  });

  it("blames the change for a package that only now reaches production", () => {
    const now = [exposure({ path: "main>zod", version: "4.5.4" })];

    assert.equal(isNew(describeExposures({ before: [], now })), true);
  });
});
