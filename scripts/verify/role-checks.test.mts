import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type RoleFacts, roleFindings } from "./role-checks.mts";

const EMPTY: RoleFacts = { backLinksWithoutText: 0, gates: 0, unmarkedEyebrows: [] };

describe("named role checks", () => {
  it("makes no claims about a page without hooks", () => {
    assert.deepEqual(roleFindings(EMPTY), []);
  });

  it("allows one gate, a named back link and the shared pieces", () => {
    assert.deepEqual(roleFindings({ ...EMPTY, gates: 1 }), []);
  });

  it("reports every measurable role mismatch as a lead", () => {
    assert.deepEqual(
      roleFindings({ backLinksWithoutText: 1, gates: 2, unmarkedEyebrows: ["Your plan"] }).map(
        ({ check, level }) => [check, level],
      ),
      [
        ["R4 one subscription gate", "warn"],
        ["E8 named back link", "warn"],
        ["R3 eyebrow piece", "warn"],
      ],
    );
  });
});
