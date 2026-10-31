import { describe, expect, it } from "vitest";
import { notationHeader, notationToDraw, practiceTempos } from "./notation-text";

const ode = "X:1\nT:Ode to Joy\nC:Beethoven, 1824\nM:4/4\nK:C\nE E F G |";

describe("notation text", () => {
  it("reads the title and composer from the header", () => {
    expect(notationHeader(ode)).toStrictEqual({ composer: "Beethoven, 1824", title: "Ode to Joy" });
    expect(notationHeader("K:C\nC D E")).toStrictEqual({ composer: null, title: null });
  });

  it("draws the music without the title lines and with a reference number", () => {
    expect(notationToDraw(ode)).toBe("X:1\nM:4/4\nK:C\nE E F G |");
    expect(notationToDraw("K:G\nG A B")).toBe("X:1\nK:G\nG A B");
  });

  it("offers slower tempos to practice at", () => {
    expect(practiceTempos(80)).toStrictEqual([50, 65, 80]);
    expect(practiceTempos(40)).toStrictEqual([25, 30, 40]);
  });
});
