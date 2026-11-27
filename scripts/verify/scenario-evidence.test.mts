import { describe, expect, it, vi } from "vitest";
import { hasEvidence, hasProof } from "./scenarios/evidence.mts";
import { SCENARIOS } from "./scenarios/scenarios.mts";
import { PHONE_AND_LAPTOP, type Scenario } from "./scenarios/shape.mts";

function pageWith(visible: string[]): Parameters<typeof hasEvidence>[0] {
  return {
    locator: (selector: string) => ({
      filter: () => ({ count: async () => Number(visible.includes(selector)) }),
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
    expect(lifted?.proof).toBe("No map yet");

    const noStop = "[data-slot=maps-not-made]:not(:has([data-slot=gate-words]))";
    await expect(hasEvidence(pageWith([noStop]), lifted?.evidence ?? [])).resolves.toBe(true);
    await expect(hasEvidence(pageWith([]), lifted?.evidence ?? [])).resolves.toBe(false);
  });
});

describe("words that prove a scenario", () => {
  it("rejects duplicate visible words and accepts an exact match in the state's own region", async () => {
    const scenario: Scenario = {
      anchors: [],
      id: "fixture",
      prerequisites: { persona: "visitor" },
      proof: "Start",
      reach: [],
      screen: "/fixture",
      sizes: PHONE_AND_LAPTOP,
    };

    const getByText = vi.fn(() => ({ filter: () => ({ count: async () => 2 }) }));
    const getScopedText = vi.fn(() => ({ filter: () => ({ count: async () => 1 }) }));
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The fake supplies the locator chain the proof uses.
    const page = {
      getByText,
      locator: () => ({ getByText: getScopedText }),
    } as unknown as Parameters<typeof hasProof>[0]["page"];

    await expect(hasProof({ page, scenario, words: "Start" })).rejects.toThrow(
      "2 visible elements",
    );

    expect(getByText).toHaveBeenCalledWith("Start", { exact: true });

    await expect(
      hasProof({ page, scenario: { ...scenario, proofWithin: "[role=dialog]" }, words: "Start" }),
    ).resolves.toBe(true);

    expect(getScopedText).toHaveBeenCalledWith("Start", { exact: true });
  });
});
