import { describe, expect, it } from "vitest";
import { getLessonLead } from "./change-names";

describe(getLessonLead, () => {
  it("says what a change adds overall when it also moves a few lessons out", () => {
    expect(getLessonLead({ added: 102, removed: 12 })).toStrictEqual({ count: 90, kind: "more" });
  });

  it("says what a change takes out overall when it also adds a few lessons", () => {
    expect(getLessonLead({ added: 3, removed: 20 })).toStrictEqual({ count: 17, kind: "fewer" });
  });

  it.each([
    { added: 0, lead: { count: 8, kind: "fewer" }, removed: 8 },
    { added: 8, lead: { count: 8, kind: "more" }, removed: 0 },
    { added: 5, lead: null, removed: 5 },
  ])("leads with $lead for $added added and $removed out", ({ added, lead, removed }) => {
    expect(getLessonLead({ added, removed })).toStrictEqual(lead);
  });
});
