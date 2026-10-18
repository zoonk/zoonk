import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { MAX_BOND_ORDER, valenceOf } from "@zoonk/core/library/activities/chemistry";

export type BuildAtom = { element: string; id: string };
export type BuildBond = { from: string; order: number; to: string };
export type Build = { atoms: readonly BuildAtom[]; bonds: readonly BuildBond[] };

/** How full an atom's bonds are: some still open, all filled, or more than it can make. */
type AtomFill = "full" | "open" | "over";

export const EMPTY_BUILD: Build = { atoms: [], bonds: [] };

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

function touches(bond: BuildBond, id: string): boolean {
  return bond.from === id || bond.to === id;
}

function isPair(bond: BuildBond, first: string, second: string): boolean {
  return touches(bond, first) && touches(bond, second);
}

/** The first free id for an element, like "o2" when "o1" is taken. */
function nextAtomId(build: Build, element: string): string {
  const prefix = element.toLowerCase();
  const taken = new Set(build.atoms.map((atom) => atom.id));
  const numbers = Array.from({ length: build.atoms.length + 1 }, (_, index) => index + 1);

  return `${prefix}${numbers.find((number) => !taken.has(`${prefix}${number}`)) ?? numbers.length}`;
}

/** Adds an atom, bonded once to `bondTo` when an atom is selected, which is how builds grow. */
export function addAtom({
  bondTo,
  build,
  element,
}: {
  bondTo: string | null;
  build: Build;
  element: string;
}): { build: Build; id: string } {
  const id = nextAtomId(build, element);

  const bonds =
    bondTo === null ? build.bonds : [...build.bonds, { from: bondTo, order: 1, to: id }];

  return { build: { atoms: [...build.atoms, { element, id }], bonds }, id };
}

export function removeAtom(build: Build, id: string): Build {
  return {
    atoms: build.atoms.filter((atom) => atom.id !== id),
    bonds: build.bonds.filter((bond) => !touches(bond, id)),
  };
}

export function bondOrder(build: Build, first: string, second: string): number {
  return build.bonds.find((bond) => isPair(bond, first, second))?.order ?? 0;
}

/** Tapping two atoms steps their bond: none, single, double, triple, then none again. */
export function stepBond(build: Build, first: string, second: string): Build {
  const order = (bondOrder(build, first, second) + 1) % (MAX_BOND_ORDER + 1);
  const others = build.bonds.filter((bond) => !isPair(bond, first, second));

  return {
    ...build,
    bonds: order === 0 ? others : [...others, { from: first, order, to: second }],
  };
}

export function bondsUsed(build: Build, id: string): number {
  return build.bonds.filter((bond) => touches(bond, id)).reduce((sum, bond) => sum + bond.order, 0);
}

export function atomFill(build: Build, atom: BuildAtom): AtomFill {
  const used = bondsUsed(build, atom.id);
  const valence = valenceOf(atom.element);

  if (used > valence) {
    return "over";
  }

  return used === valence ? "full" : "open";
}

/** How many of each element the build has, in the order the target formula lists them. */
export function builtCounts(build: Build): Record<string, number> {
  const elements = [...new Set(build.atoms.map((atom) => atom.element))];

  return Object.fromEntries(
    elements.map((element) => [
      element,
      build.atoms.filter((atom) => atom.element === element).length,
    ]),
  );
}

/** "CO₂" from counts, elements in the given order and then the rest. */
export function formulaText(
  counts: Readonly<Record<string, number>>,
  order: readonly string[],
): string {
  const elements = [...new Set([...order, ...Object.keys(counts)])].filter(
    (element) => (counts[element] ?? 0) > 0,
  );

  return elements
    .map((element) => {
      const count = counts[element] ?? 0;

      const digits =
        count === 1
          ? ""
          : String(count).replaceAll(/\d/gu, (digit) => SUBSCRIPTS.charAt(Number(digit)));

      return `${element}${digits}`;
    })
    .join("");
}

/** The number a numeric check reads: every bond counted by its order, as core counts them. */
export function bondTotal(build: Build): number {
  return build.bonds.reduce((sum, bond) => sum + bond.order, 0);
}

/** The build as an answer, once there's something to grade. */
export function moleculeAnswer(build: Build): ActivityAnswer | null {
  return build.atoms.length === 0
    ? null
    : { atoms: [...build.atoms], bonds: [...build.bonds], kind: "molecule" };
}
