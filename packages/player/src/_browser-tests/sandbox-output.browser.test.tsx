import { MAX_PROGRAM_OUTPUT_LENGTH } from "@zoonk/core/library/activities/program-limits";
import { describe, expect, it } from "vitest";
import { runProgram } from "../activities/_sandbox/run-program";

describe("sandbox output", () => {
  it("caps what a program writes to stderr and the error it throws, as it caps stdout", async () => {
    const [flooded, thrown] = await Promise.all([
      runProgram({ code: 'console.error("x".repeat(2_000_000));', language: "javascript" }),
      runProgram({ code: 'throw new Error("x".repeat(2_000_000));', language: "javascript" }),
    ]);

    expect(flooded.errorOutput).toHaveLength(MAX_PROGRAM_OUTPUT_LENGTH);
    expect(thrown.stop).toBe("error");
    expect(thrown.error?.message.length).toBeLessThanOrEqual(MAX_PROGRAM_OUTPUT_LENGTH);
  });
});
