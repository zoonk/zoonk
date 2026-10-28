import {
  type ElementCounts,
  MAX_BOND_ORDER,
  type MoleculeBuild,
  isKnownElement,
  valenceOf,
} from "./chemistry";

const MAX_SEARCH_STEPS = 20_000;

type SearchAtom = { element: string; id: string; valence: number };
type SearchState = { bonds: ReadonlyMap<string, number>; remaining: readonly number[] };

function pairKey(first: number, second: number): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function expandAtoms(counts: Readonly<ElementCounts>): SearchAtom[] {
  return Object.entries(counts)
    .toSorted(
      ([first], [second]) => valenceOf(second) - valenceOf(first) || first.localeCompare(second),
    )
    .flatMap(([element, count]) =>
      Array.from({ length: count }, (_, index) => ({
        element,
        id: `${element.toLowerCase()}${index + 1}`,
        valence: valenceOf(element),
      })),
    );
}

function bondedTo(state: SearchState, index: number): number[] {
  return [...state.bonds.keys()].flatMap((key) => {
    const [first, second] = key.split("|").map(Number);

    if (first === index && second !== undefined) {
      return [second];
    }

    return second === index && first !== undefined ? [first] : [];
  });
}

function componentOf(state: SearchState, reached: ReadonlySet<number>): ReadonlySet<number> {
  const grown = new Set([...reached, ...[...reached].flatMap((index) => bondedTo(state, index))]);
  return grown.size === reached.size ? reached : componentOf(state, grown);
}

function addBond(state: SearchState, first: number, second: number): SearchState {
  const key = pairKey(first, second);
  const bonds = new Map(state.bonds).set(key, (state.bonds.get(key) ?? 0) + 1);

  const remaining = state.remaining.map((value, index) =>
    index === first || index === second ? value - 1 : value,
  );

  return { bonds, remaining };
}

function bondCandidates(atoms: readonly SearchAtom[], state: SearchState, index: number) {
  const isUntouched = (atom: number) => state.remaining[atom] === atoms[atom]?.valence;
  const component = componentOf(state, new Set([index]));

  const open = atoms
    .map((_, atom) => atom)
    .filter(
      (atom) =>
        atom !== index &&
        (state.remaining[atom] ?? 0) > 0 &&
        (state.bonds.get(pairKey(index, atom)) ?? 0) < MAX_BOND_ORDER,
    );

  return open
    .filter(
      (atom) =>
        !open.some(
          (earlier) =>
            earlier < atom &&
            isUntouched(atom) &&
            isUntouched(earlier) &&
            atoms[earlier]?.element === atoms[atom]?.element,
        ),
    )
    .toSorted(
      (first, second) =>
        Number(component.has(first)) - Number(component.has(second)) ||
        (state.remaining[second] ?? 0) - (state.remaining[first] ?? 0),
    );
}

function searchStructure(
  atoms: readonly SearchAtom[],
  state: SearchState,
  budget: { left: number },
): SearchState | null {
  if (budget.left <= 0) {
    return null;
  }

  budget.left -= 1;
  const index = state.remaining.findIndex((value) => value > 0);

  if (index === -1) {
    return componentOf(state, new Set([0])).size === atoms.length ? state : null;
  }

  return bondCandidates(atoms, state, index).reduce<SearchState | null>(
    (found, atom) => found ?? searchStructure(atoms, addBond(state, index, atom), budget),
    null,
  );
}

export function findMoleculeStructure(counts: Readonly<ElementCounts>): MoleculeBuild | null {
  const atoms = expandAtoms(counts);

  if (atoms.length === 0 || atoms.some((atom) => atom.valence === 0)) {
    return null;
  }

  const found = searchStructure(
    atoms,
    { bonds: new Map(), remaining: atoms.map((atom) => atom.valence) },
    { left: MAX_SEARCH_STEPS },
  );

  if (!found) {
    return null;
  }

  return {
    atoms: atoms.map(({ element, id }) => ({ element, id })),
    bonds: [...found.bonds].map(([key, order]) => {
      const [first = 0, second = 0] = key.split("|").map(Number);
      return { from: atoms[first]?.id ?? "", order, to: atoms[second]?.id ?? "" };
    }),
  };
}

function passesBondCounts(counts: Readonly<ElementCounts>): boolean {
  const entries = Object.entries(counts);
  const atomCount = entries.reduce((sum, [, count]) => sum + count, 0);
  const bondEnds = entries.reduce((sum, [element, count]) => sum + valenceOf(element) * count, 0);

  return (
    atomCount > 0 &&
    entries.every(([element]) => isKnownElement(element)) &&
    bondEnds % 2 === 0 &&
    bondEnds / 2 >= atomCount - 1 &&
    entries.every(([element]) => valenceOf(element) <= bondEnds - valenceOf(element))
  );
}

export function isBuildableMolecule(counts: Readonly<ElementCounts>): boolean {
  return passesBondCounts(counts) && findMoleculeStructure(counts) !== null;
}
