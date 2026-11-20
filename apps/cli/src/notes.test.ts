import { describe, expect, it } from "vitest";
import { proposalNote, revertNote, withdrawalNote } from "./notes.ts";

const BATCH_URL = "https://admin.zoonk.com/content-fixes/batches/b1";

describe("notes after a content fix command", () => {
  it("links one fix to its own page and a batch to the batch's", () => {
    expect(
      proposalNote({
        fixes: [{ reviewUrl: "https://admin.zoonk.com/content-fixes/f1" }],
        reviewUrl: BATCH_URL,
      }),
    ).toBe(
      "Proposed 1 fix. Nothing changes until a staff person approves it in Admin: https://admin.zoonk.com/content-fixes/f1",
    );

    expect(revertNote({ fixes: [{}, {}], reviewUrl: BATCH_URL })).toBe(
      `Proposed undoing 2 fixes to review together. Nothing changes until a staff person approves them in Admin: ${BATCH_URL}`,
    );
  });

  it("says what a withdrawal took back and what stays", () => {
    expect(
      withdrawalNote({
        fixes: [{ status: "withdrawn" }, { status: "applied" }, { status: "approved" }],
        withdrawn: 1,
      }),
    ).toBe(
      "Withdrew 1 fix, so nobody will review it. The content didn't change. 2 fixes were already decided and stay as they are.",
    );

    expect(withdrawalNote({ fixes: [{ status: "withdrawn" }], withdrawn: 0 })).toBe(
      "Already withdrawn. Nothing changed.",
    );
  });
});
