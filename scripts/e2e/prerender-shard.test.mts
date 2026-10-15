import { describe, expect, it } from "vitest";
import { selectPrerenderShard } from "./prerender-shard.mts";

const items = ["a", "b", "c", "d", "e", "f", "g"];

describe("prerender crawl shards", () => {
  it("crawls every page without a shard", () => {
    expect(selectPrerenderShard({ items, shard: undefined })).toStrictEqual(items);
    expect(selectPrerenderShard({ items, shard: "" })).toStrictEqual(items);
  });

  it("splits pages so every page belongs to exactly one shard", () => {
    const shards = ["1/3", "2/3", "3/3"].map((shard) => selectPrerenderShard({ items, shard }));

    expect(shards).toStrictEqual([
      ["a", "d", "g"],
      ["b", "e"],
      ["c", "f"],
    ]);

    expect(shards.flat().toSorted()).toStrictEqual(items);
  });

  it.each(["0/4", "5/4", "1/0", "1", "1/4/2", "a/4", " 1/4"])(
    "rejects the malformed shard %s",
    (shard) => {
      expect(() => selectPrerenderShard({ items, shard })).toThrow("Invalid prerender shard");
    },
  );
});
