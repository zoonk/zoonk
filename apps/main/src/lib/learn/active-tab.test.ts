import { describe, expect, it } from "vitest";
import { getActiveTab } from "./active-tab";

describe(getActiveTab, () => {
  it("marks a tab on its own page", () => {
    expect(getActiveTab("/today")).toBe("today");
    expect(getActiveTab("/plan")).toBe("journey");
    expect(getActiveTab("/buddy")).toBe("buddy");
  });

  it("keeps the tab on the pages it opens", () => {
    expect(getActiveTab("/plan/math")).toBe("journey");
    expect(getActiveTab("/content/chapters/0f3a9c1e")).toBe("journey");
    expect(getActiveTab("/content/units/0f3a9c1e")).toBe("journey");
    expect(getActiveTab("/buddy/earlier-questions")).toBe("buddy");
  });

  it("marks no tab on a page the sidebar lists on its own", () => {
    const listed = [
      "/mistakes",
      "/mind-maps",
      "/mock",
      "/exam",
      "/speaking",
      "/completed-lessons",
      "/certificates",
      "/level",
      "/settings",
      "/courses",
    ];

    expect(listed.map((path) => getActiveTab(path))).toStrictEqual(listed.map(() => null));
  });
});
