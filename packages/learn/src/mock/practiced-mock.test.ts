import { describe, expect, it } from "vitest";
import { getPracticedMock } from "./practiced-mock";

const MOCK_ID = "0195c1f0-0000-7000-8000-000000000001";

describe(getPracticedMock, () => {
  it("offers practice on a mock with mistakes left to practice", () => {
    expect(
      getPracticedMock({ mockId: MOCK_ID, practiceAvailable: true, purpose: "practice" }),
    ).toBe(MOCK_ID);
  });

  it("offers nothing once the mock's mistakes are all fixed, or for a placement", () => {
    expect(
      getPracticedMock({ mockId: MOCK_ID, practiceAvailable: false, purpose: "practice" }),
    ).toBeNull();

    expect(
      getPracticedMock({ mockId: MOCK_ID, practiceAvailable: true, purpose: "placement" }),
    ).toBeNull();
  });
});
