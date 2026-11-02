import { describe, expect, it } from "vitest";
import { withQuery } from "./with-query";

describe(withQuery, () => {
  it("keeps the path alone without a query", () => {
    expect(withQuery("/session", {})).toBe("/session");
    expect(withQuery("/session", { from: undefined })).toBe("/session");
  });

  it("adds every value, repeated keys too, encoded", () => {
    expect(withQuery("/conversation/c1", { from: "exam", mock: "m 1" })).toBe(
      "/conversation/c1?from=exam&mock=m+1",
    );

    expect(withQuery("/mock/b1", { day: ["1", "2"] })).toBe("/mock/b1?day=1&day=2");
  });
});
