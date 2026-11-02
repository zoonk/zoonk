import { describe, expect, it } from "vitest";
import { getSafeAppRelativePath } from "./ott-redirect";

describe(getSafeAppRelativePath, () => {
  it.each(["\t", "\n", "\r", "\u0000", "\u0008", "\u001F", "\u007F"])(
    "rejects an ASCII control character in a return path (%j)",
    (control) => {
      expect(getSafeAppRelativePath(`/${control}/evil.example`)).toBeNull();
      expect(getSafeAppRelativePath(`/plan?name=${control}`)).toBeNull();
    },
  );

  it("keeps safe relative paths and rejects network paths, backslashes and absolute origins", () => {
    expect(getSafeAppRelativePath("/pt/plan?from=today#week")).toBe("/pt/plan?from=today#week");

    for (const path of ["//evil.example", String.raw`/\evil.example`, "https://evil.example"]) {
      expect(getSafeAppRelativePath(path)).toBeNull();
    }
  });
});
