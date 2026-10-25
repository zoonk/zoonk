import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { dealShardTests, takeShardArgument } from "./shard-test-list.mts";

const LISTING = [
  "Listing tests:",
  "  [chromium] › a.test.ts:1:1 › a › one",
  "  [chromium] › a.test.ts:2:1 › a › two",
  "  [chromium] › a.test.ts:3:1 › a › three",
  "  [chromium] › b.test.ts:1:1 › b › one",
  "  [chromium] › b.test.ts:2:1 › b › two",
  "Total: 5 tests in 2 files",
].join("\n");

describe(takeShardArgument, () => {
  it("takes the shard from either form and keeps the other arguments", () => {
    assert.deepEqual(takeShardArgument(["--project=chromium", "--shard=2/3", "--workers=2"]), {
      rest: ["--project=chromium", "--workers=2"],
      shard: { current: 2, total: 3 },
    });

    assert.deepEqual(takeShardArgument(["--shard", "3/3", "e2e/a.test.ts"]), {
      rest: ["e2e/a.test.ts"],
      shard: { current: 3, total: 3 },
    });
  });

  it("leaves a run without a shard as it is", () => {
    assert.deepEqual(takeShardArgument(["e2e/a.test.ts"]), {
      rest: ["e2e/a.test.ts"],
      shard: null,
    });
  });

  it("rejects a shard outside its total", () => {
    assert.throws(() => takeShardArgument(["--shard=4/3"]), /Invalid shard "4\/3"/u);
  });
});

describe(dealShardTests, () => {
  it("deals every file's tests across the shards, each test to exactly one", () => {
    const shards = [1, 2].map((current) =>
      dealShardTests({ listing: LISTING, shard: { current, total: 2 } }),
    );

    assert.deepEqual(shards, [
      [
        "[chromium] › a.test.ts:1:1 › a › one",
        "[chromium] › a.test.ts:3:1 › a › three",
        "[chromium] › b.test.ts:2:1 › b › two",
      ].join("\n"),
      ["[chromium] › a.test.ts:2:1 › a › two", "[chromium] › b.test.ts:1:1 › b › one"].join("\n"),
    ]);
  });
});
