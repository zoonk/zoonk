const TETRAVALENT = 4;

const VALENCE: ReadonlyMap<string, number> = new Map([
  ["B", 3],
  ["Br", 1],
  ["C", TETRAVALENT],
  ["Cl", 1],
  ["F", 1],
  ["H", 1],
  ["I", 1],
  ["N", 3],
  ["O", 2],
  ["P", 3],
  ["S", 2],
  ["Si", TETRAVALENT],
]);

export const MAX_BOND_ORDER = 3;

export type ElementCounts = Record<string, number>;

export type MoleculeBuild = {
  atoms: readonly { element: string; id: string }[];
  bonds: readonly { from: string; order: number; to: string }[];
};

export function isKnownElement(element: string): boolean {
  return VALENCE.has(element);
}

export function valenceOf(element: string): number {
  return VALENCE.get(element) ?? 0;
}

export function parseMolecularFormula(formula: string): ElementCounts | null {
  const matches = [...formula.matchAll(/(?<element>[A-Z][a-z]?)(?<count>\d*)/gu)];

  if (matches.length === 0 || matches.map((match) => match[0]).join("") !== formula) {
    return null;
  }

  const counts = matches.reduce((totals, match) => {
    const element = match.groups?.element ?? "";
    const count = match.groups?.count ? Number(match.groups.count) : 1;

    return totals.set(element, (totals.get(element) ?? 0) + count);
  }, new Map<string, number>());

  return Object.fromEntries(counts);
}

export function countBonds(counts: Readonly<ElementCounts>): number {
  return (
    Object.entries(counts).reduce((sum, [element, count]) => sum + valenceOf(element) * count, 0) /
    2
  );
}

function bondOrderSum(build: MoleculeBuild, atomId: string): number {
  return build.bonds
    .filter((bond) => bond.from === atomId || bond.to === atomId)
    .reduce((sum, bond) => sum + bond.order, 0);
}

function reachableAtoms(build: MoleculeBuild, visited: ReadonlySet<string>): ReadonlySet<string> {
  const next = new Set(
    build.bonds.flatMap((bond) => {
      if (visited.has(bond.from)) {
        return [bond.to];
      }

      return visited.has(bond.to) ? [bond.from] : [];
    }),
  );

  const grown = new Set([...visited, ...next]);

  return grown.size === visited.size ? visited : reachableAtoms(build, grown);
}

function hasValidBonds(build: MoleculeBuild): boolean {
  const ids = new Set(build.atoms.map((atom) => atom.id));
  const pairs = build.bonds.map((bond) => [bond.from, bond.to].toSorted().join("|"));

  return (
    ids.size === build.atoms.length &&
    new Set(pairs).size === pairs.length &&
    build.bonds.every(
      (bond) =>
        bond.from !== bond.to &&
        ids.has(bond.from) &&
        ids.has(bond.to) &&
        Number.isInteger(bond.order) &&
        bond.order >= 1 &&
        bond.order <= MAX_BOND_ORDER,
    )
  );
}

/** Accepts any complete isomer matching the formula, not only the reference structure. */
export function isCompleteMolecule(build: MoleculeBuild, counts: Readonly<ElementCounts>): boolean {
  const built = build.atoms.reduce(
    (totals, atom) => totals.set(atom.element, (totals.get(atom.element) ?? 0) + 1),
    new Map<string, number>(),
  );

  const sameAtoms =
    built.size === Object.keys(counts).length &&
    Object.entries(counts).every(([element, count]) => built.get(element) === count);

  const [first] = build.atoms;

  return (
    sameAtoms &&
    hasValidBonds(build) &&
    build.atoms.every((atom) => bondOrderSum(build, atom.id) === valenceOf(atom.element)) &&
    first !== undefined &&
    reachableAtoms(build, new Set([first.id])).size === build.atoms.length
  );
}
