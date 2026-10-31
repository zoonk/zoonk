import { describe, expect, it } from "vitest";
import { countBonds, isCompleteMolecule, parseMolecularFormula } from "./chemistry";
import { findMoleculeStructure, isBuildableMolecule } from "./molecule-structure";

function counts(formula: string) {
  const parsed = parseMolecularFormula(formula);

  if (!parsed) {
    throw new Error(`Unreadable formula ${formula}`);
  }

  return parsed;
}

const BUILDABLE = [
  "H2",
  "O2",
  "N2",
  "H2O",
  "CO2",
  "CH4",
  "NH3",
  "HCN",
  "H2O2",
  "C2H2",
  "C2H4",
  "C2H6",
  "C2H6O",
  "CH3OH",
  "C3H8",
  "CH2O",
  "HCl",
  "PCl3",
  "SiO2",
  "C2H4O2",
];

describe(findMoleculeStructure, () => {
  it.each(BUILDABLE)("finds a complete structure for %s", (formula) => {
    const build = findMoleculeStructure(counts(formula));

    expect(build).not.toBeNull();
    expect(build && isCompleteMolecule(build, counts(formula))).toBe(true);

    expect(build?.bonds.reduce((sum, bond) => sum + bond.order, 0)).toBe(
      countBonds(counts(formula)),
    );
  });

  it("builds carbon dioxide as two double bonds around the carbon", () => {
    expect(findMoleculeStructure(counts("CO2"))?.bonds).toStrictEqual([
      { from: "c1", order: 2, to: "o1" },
      { from: "c1", order: 2, to: "o2" },
    ]);
  });

  it.each(["C2", "CO", "H", "H3", "CH2", "O3H"])("finds nothing for %s", (formula) => {
    expect(findMoleculeStructure(counts(formula))).toBeNull();
  });
});

describe(isBuildableMolecule, () => {
  it("needs a real structure, not just an even number of bond ends", () => {
    expect(isBuildableMolecule(counts("C2"))).toBe(false);
    expect(isBuildableMolecule(counts("C2H2"))).toBe(true);
  });

  it("rejects elements lessons don't build with", () => {
    expect(isBuildableMolecule({ He: 2 })).toBe(false);
  });
});
