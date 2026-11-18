import { describe, expect, it } from "vitest";
import { hasEvidence } from "./scenarios/evidence.mts";
import { SCENARIOS } from "./scenarios/scenarios.mts";

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

  it("recognizes the lifted mind-map offer only when its stop notice is gone", async () => {
    const lifted = SCENARIOS.find((scenario) => scenario.id === "mind-maps.offer.lifted");
    expect(lifted?.proof).toBe("Without a map");

    const noStop = "[data-slot=maps-not-made]:not(:has([data-slot=gate-words]))";
    await expect(hasEvidence(pageWith([noStop]), lifted?.evidence ?? [])).resolves.toBe(true);
    await expect(hasEvidence(pageWith([]), lifted?.evidence ?? [])).resolves.toBe(false);
  });
});
