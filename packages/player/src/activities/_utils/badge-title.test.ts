import { describe, expect, it } from "vitest";
import { opensTitle } from "./badge-title";

describe(opensTitle, () => {
  it("finds a chip whose words open the title, whatever the case", () => {
    expect(
      opensTitle({ label: "Drag a corner", title: "Drag a corner and watch the angles." }),
    ).toBe(true);

    expect(opensTitle({ label: "Turn it", title: "turn it to 30°." })).toBe(true);
  });

  it("keeps a chip the title doesn't open with", () => {
    expect(opensTitle({ label: "Estimate first", title: "How long is a million seconds?" })).toBe(
      false,
    );

    expect(opensTitle({ label: "Move a line", title: "Now drag a line. Move a line twice." })).toBe(
      false,
    );
  });
});
