import { describe, expect, it } from "vitest";
import { testRegex } from "../activities/pattern-tester/pattern-results";

const zip = {
  shouldMatch: ["94103", "94103-1234"],
  shouldNotMatch: ["9410", "941031", "94103-12"],
};

describe(testRegex, () => {
  it("marks where the pattern matches and whether each example passes", async () => {
    const results = await testRegex(String.raw`^\d{5}`, zip);

    expect(results).toMatchObject({
      shouldMatch: [
        { match: { end: 5, start: 0 }, passes: true, sample: "94103" },
        { match: { end: 5, start: 0 }, passes: true, sample: "94103-1234" },
      ],
      shouldNotMatch: [
        { match: null, passes: true, sample: "9410" },
        { passes: false, sample: "941031" },
        { passes: false, sample: "94103-12" },
      ],
      status: "tested",
    });
  });

  it("passes every example with the full pattern", async () => {
    const results = await testRegex(String.raw`^\d{5}(-\d{4})?$`, zip);

    expect(
      results.status === "tested" &&
        [...results.shouldMatch, ...results.shouldNotMatch].every((row) => row.passes),
    ).toBe(true);
  });

  it("refuses patterns grading refuses", async () => {
    await expect(testRegex("", zip)).resolves.toStrictEqual({ status: "empty" });
    await expect(testRegex("(", zip)).resolves.toStrictEqual({ status: "invalid" });
    await expect(testRegex("(a+)+$", zip)).resolves.toStrictEqual({ status: "invalid" });
  });
});
