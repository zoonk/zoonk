import { describe, expect, it } from "vitest";
import { getMockEntryTarget } from "./mock-entry-target";

const hrefs = { choose: "/mock/new", mock: (id: string) => `/mock/${id}` };

const option = { kind: "full" };

const running = { id: "anytime-1" };

describe(getMockEntryTarget, () => {
  it("goes on with a mock the plan started, which the chooser doesn't list as running", () => {
    expect(
      getMockEntryTarget({
        hrefs,
        runningId: "planned-1",
        view: { options: [option], running: null },
      }),
    ).toStrictEqual({ href: "/mock/planned-1", resume: true });
  });

  it("goes on with the mock the chooser started", () => {
    expect(getMockEntryTarget({ hrefs, view: { options: [option], running } })).toStrictEqual({
      href: "/mock/anytime-1",
      resume: true,
    });
  });

  it("opens the chooser when nothing is running", () => {
    expect(
      getMockEntryTarget({ hrefs, runningId: null, view: { options: [option], running: null } }),
    ).toStrictEqual({ href: "/mock/new", resume: false });
  });

  it("offers nothing when no mock can start and none is running", () => {
    expect(getMockEntryTarget({ hrefs, view: { options: [], running: null } })).toBeNull();
  });
});
