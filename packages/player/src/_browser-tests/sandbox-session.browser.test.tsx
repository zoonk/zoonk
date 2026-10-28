import { describe, expect, it } from "vitest";
import { runProgram } from "../activities/_sandbox/run-program";

describe("sandbox session isolation", () => {
  it("learner code runs without the page's origin, so it can't use the learner's session", async () => {
    const run = await runProgram({ code: "console.log(self.origin);", language: "javascript" });

    expect(run.output).toBe("null\n");
  });
});
