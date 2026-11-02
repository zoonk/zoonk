import {
  isCompleteMolecule,
  parseMolecularFormula,
} from "@zoonk/core/library/activities/chemistry";
import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD,
  addAtom,
  atomFill,
  bondOrder,
  bondTotal,
  builtCounts,
  formulaText,
  moleculeAnswer,
  removeAtom,
  stepBond,
} from "./molecule-model";

function buildCarbonDioxide() {
  const carbon = addAtom({ bondTo: null, build: EMPTY_BUILD, element: "C" });
  const first = addAtom({ bondTo: carbon.id, build: carbon.build, element: "O" });
  const second = addAtom({ bondTo: carbon.id, build: first.build, element: "O" });

  return { build: second.build, ids: [carbon.id, first.id, second.id] };
}

describe(addAtom, () => {
  it("gives each atom its own id and bonds it to the selected atom", () => {
    const { build, ids } = buildCarbonDioxide();

    expect(ids).toStrictEqual(["c1", "o1", "o2"]);

    expect(build.bonds).toStrictEqual([
      { from: "c1", order: 1, to: "o1" },
      { from: "c1", order: 1, to: "o2" },
    ]);
  });

  it("reuses a free id after an atom is removed", () => {
    const { build } = buildCarbonDioxide();
    const trimmed = removeAtom(build, "o1");

    expect(trimmed.bonds).toStrictEqual([{ from: "c1", order: 1, to: "o2" }]);
    expect(addAtom({ bondTo: null, build: trimmed, element: "O" }).id).toBe("o1");
  });
});

describe(stepBond, () => {
  it("steps a bond from single to triple and then removes it", () => {
    const { build } = buildCarbonDioxide();
    const double = stepBond(build, "o1", "c1");
    const triple = stepBond(double, "c1", "o1");

    expect(bondOrder(double, "c1", "o1")).toBe(2);
    expect(bondOrder(triple, "c1", "o1")).toBe(3);
    expect(bondOrder(stepBond(triple, "c1", "o1"), "c1", "o1")).toBe(0);
    expect(bondOrder(stepBond(build, "o1", "o2"), "o1", "o2")).toBe(1);
  });
});

describe(atomFill, () => {
  it("tells open, full and over-filled atoms apart by their valence", () => {
    const { build } = buildCarbonDioxide();
    const done = stepBond(stepBond(build, "c1", "o1"), "c1", "o2");
    const over = stepBond(done, "c1", "o1");

    expect(atomFill(build, { element: "C", id: "c1" })).toBe("open");
    expect(atomFill(done, { element: "C", id: "c1" })).toBe("full");
    expect(atomFill(over, { element: "C", id: "c1" })).toBe("over");
    expect(isCompleteMolecule(done, parseMolecularFormula("CO2") ?? {})).toBe(true);
    expect(bondTotal(done)).toBe(4);
  });
});

describe(formulaText, () => {
  it("writes the build's formula with subscripts in the target's element order", () => {
    const { build } = buildCarbonDioxide();

    expect(formulaText(builtCounts(build), ["C", "O"])).toBe("CO₂");
    expect(formulaText(parseMolecularFormula("C2H12O") ?? {}, ["C", "H", "O"])).toBe("C₂H₁₂O");
    expect(formulaText(parseMolecularFormula("H2O") ?? {}, ["C", "O"])).toBe("OH₂");
  });
});

describe(moleculeAnswer, () => {
  it("answers once something is built", () => {
    expect(moleculeAnswer(EMPTY_BUILD)).toBeNull();
    expect(moleculeAnswer(buildCarbonDioxide().build)).toMatchObject({ kind: "molecule" });
  });
});
