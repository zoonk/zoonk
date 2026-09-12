import { describe, expect, it } from "vitest";
import { parseGenerationBackTo, parseGenerationReturnTo } from "./generation-return-to";

const id = "5487fdec-7fc1-444e-8730-8d414d689240";

describe(parseGenerationReturnTo, () => {
  it("accepts only persisted discovery and track routes", () => {
    expect(parseGenerationReturnTo(`/tracks/${id}`)).toBe(`/tracks/${id}`);
    expect(parseGenerationReturnTo(`/start/discovery/${id}`)).toBe(`/start/discovery/${id}`);
  });

  it.each([
    undefined,
    ["/tracks/x"],
    "https://example.com",
    `//example.com/tracks/${id}`,
    `/tracks/${id}?next=/`,
    `/tracks/${id}#foo`,
    `/tracks/${id}/..`,
    "/tracks/not-an-id",
  ])("rejects redirect input %s", (value) => {
    expect(parseGenerationReturnTo(value)).toBeNull();
  });
});

describe(parseGenerationBackTo, () => {
  it("accepts only a local chapter source anchor", () => {
    expect(parseGenerationBackTo(`/b/me/c/my-course/ch/first-chapter#optional-${id}`)).toBe(
      `/b/me/c/my-course/ch/first-chapter#optional-${id}`,
    );

    for (const value of [
      `//example.com/b/me/c/test/ch/one#optional-${id}`,
      `/b/me/c/../ch/one#optional-${id}`,
      `/b/me/c/test/ch/one?next=https://example.com#optional-${id}`,
      `/b/me/c/test/ch/one#other-${id}`,
    ]) {
      expect(parseGenerationBackTo(value)).toBeNull();
    }
  });
});
