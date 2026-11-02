import { describe, expect, it } from "vitest";
import { memoryUndoInputSchema } from "./memory-contract";

const FACT_ID = "0b8f6a8e-5d0c-4c0f-9a51-3a6f1b2c4d5e";

describe("undoing memory changes", () => {
  it("reads an id a client leaves out as null", () => {
    expect(memoryUndoInputSchema.parse({ changes: [{ previousFactId: FACT_ID }] })).toStrictEqual({
      changes: [{ factId: null, previousFactId: FACT_ID }],
    });
  });

  it("refuses a change without either id", () => {
    expect(memoryUndoInputSchema.safeParse({ changes: [{}] }).success).toBe(false);
  });
});
