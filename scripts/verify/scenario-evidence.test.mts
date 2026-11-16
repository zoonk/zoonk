import { describe, expect, it } from "vitest";
import { hasEvidence } from "./scenarios/evidence.mts";

function pageWith(visible: string[]) {
  return {
    locator: (selector: string) => ({
      first: () => ({ isVisible: async () => visible.includes(selector) }),
    }),
  };
}

describe("compound scenario evidence", () => {
  it("rejects a missing or hidden part even when the page title shows", async () => {
    await expect(hasEvidence(pageWith(["h1"]), ["h1", "aside"])).resolves.toBe(false);
  });

  it("requires the pressed flag and the failure notice together", async () => {
    const parts = ['button[aria-pressed="true"]', '[role="status"]'];
    await expect(hasEvidence(pageWith(parts), parts)).resolves.toBe(true);
    await expect(hasEvidence(pageWith([parts[1] ?? ""]), parts)).resolves.toBe(false);
    await expect(hasEvidence(pageWith([parts[0] ?? ""]), parts)).resolves.toBe(false);
  });
});
