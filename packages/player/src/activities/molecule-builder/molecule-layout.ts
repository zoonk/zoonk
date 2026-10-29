import { clamp } from "../_utils/snap-value";

export type LayoutPoint = { x: number; y: number };
type LayoutSize = { height: number; width: number };
export type Layout = Readonly<Record<string, LayoutPoint>>;
type LayoutBond = { from: string; to: string };

export const ATOM_RADIUS = 23;

export const LAYOUT_SIZE: LayoutSize = { height: 240, width: 320 };
const BOND_LENGTH = 68;
const MARGIN = ATOM_RADIUS + 10;
const ITERATIONS = 160;
const SPRING = 0.12;
const PUSH = 0.06;
const PUSH_RANGE = 110;
const DIRECTIONS = 12;
const GRID_STEP = 24;

function distance(first: LayoutPoint, second: LayoutPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function clampToCanvas(point: LayoutPoint, size: LayoutSize): LayoutPoint {
  return {
    x: clamp(point.x, MARGIN, Math.max(MARGIN, size.width - MARGIN)),
    y: clamp(point.y, MARGIN, Math.max(MARGIN, size.height - MARGIN)),
  };
}

function roomiest(candidates: readonly LayoutPoint[], others: readonly LayoutPoint[]): LayoutPoint {
  const room = (point: LayoutPoint) =>
    others.length === 0 ? 0 : Math.min(...others.map((other) => distance(point, other)));

  return candidates.reduce((best, point) => (room(point) > room(best) + 1 ? point : best));
}

export function placeNewAtom({
  anchor,
  layout,
  size,
}: {
  anchor: string | null;
  layout: Layout;
  size: LayoutSize;
}): LayoutPoint {
  const center = { x: size.width / 2, y: size.height / 2 };
  const from = anchor === null ? undefined : layout[anchor];
  const others = Object.entries(layout).flatMap(([id, point]) => (id === anchor ? [] : [point]));

  if (!from) {
    const columns = Math.max(Math.floor((size.width - MARGIN * 2) / GRID_STEP), 1);
    const rows = Math.max(Math.floor((size.height - MARGIN * 2) / GRID_STEP), 1);

    const grid = Array.from({ length: (columns + 1) * (rows + 1) }, (_, index) => ({
      x: MARGIN + (index % (columns + 1)) * GRID_STEP,
      y: MARGIN + Math.floor(index / (columns + 1)) * GRID_STEP,
    })).toSorted((first, second) => distance(first, center) - distance(second, center));

    return others.length === 0 ? center : roomiest(grid, others);
  }

  const around = Array.from({ length: DIRECTIONS }, (_, index) => {
    const angle = (index / DIRECTIONS) * 2 * Math.PI;

    return clampToCanvas(
      { x: from.x + BOND_LENGTH * Math.cos(angle), y: from.y + BOND_LENGTH * Math.sin(angle) },
      size,
    );
  });

  return roomiest(around, others.length === 0 ? [center] : others);
}

function isBonded(bonds: readonly LayoutBond[], first: string, second: string): boolean {
  return bonds.some(
    (bond) =>
      (bond.from === first && bond.to === second) || (bond.from === second && bond.to === first),
  );
}

function relaxStep(layout: Layout, bonds: readonly LayoutBond[], size: LayoutSize): Layout {
  const entries = Object.entries(layout);

  return Object.fromEntries(
    entries.map(([id, point], index) => {
      const force = entries.reduce(
        (total, [otherId, other], otherIndex) => {
          if (otherId === id) {
            return total;
          }

          const gap = distance(point, other);

          const [dx, dy] =
            gap === 0
              ? [Math.cos(index - otherIndex), Math.sin(index - otherIndex)]
              : [(point.x - other.x) / gap, (point.y - other.y) / gap];

          const pull = isBonded(bonds, id, otherId) ? (BOND_LENGTH - gap) * SPRING : 0;
          const push = gap < PUSH_RANGE ? (PUSH_RANGE - gap) * PUSH : 0;

          return { x: total.x + dx * (pull + push), y: total.y + dy * (pull + push) };
        },
        { x: 0, y: 0 },
      );

      return [id, clampToCanvas({ x: point.x + force.x, y: point.y + force.y }, size)];
    }),
  );
}

export function relaxLayout({
  bonds,
  layout,
  size,
}: {
  bonds: readonly LayoutBond[];
  layout: Layout;
  size: LayoutSize;
}): Layout {
  return Array.from({ length: ITERATIONS }).reduce<Layout>(
    (current) => relaxStep(current, bonds, size),
    layout,
  );
}

/** Only the build's own atoms take part: a removed atom's old place would keep pushing the rest. */
export function settleLayout({
  atoms,
  bonds,
  layout,
}: {
  atoms: readonly { id: string }[];
  bonds: readonly LayoutBond[];
  layout: Layout;
}): Layout {
  const kept = Object.fromEntries(
    atoms.flatMap((atom) => {
      const point = layout[atom.id];
      return point ? [[atom.id, point] as const] : [];
    }),
  );

  return relaxLayout({ bonds, layout: kept, size: LAYOUT_SIZE });
}

function partnersOf(bonds: readonly LayoutBond[], id: string): string[] {
  return bonds.flatMap((bond) => {
    if (bond.from === id) {
      return [bond.to];
    }

    return bond.to === id ? [bond.from] : [];
  });
}

function placeInTurn({
  atoms,
  bonds,
  layout,
  size,
}: {
  atoms: readonly { id: string }[];
  bonds: readonly LayoutBond[];
  layout: Layout;
  size: LayoutSize;
}): Layout {
  const [atom, ...rest] = atoms;

  if (!atom) {
    return layout;
  }

  const anchor = partnersOf(bonds, atom.id).find((id) => layout[id] !== undefined) ?? null;
  const placed = { ...layout, [atom.id]: placeNewAtom({ anchor, layout, size }) };

  return placeInTurn({ atoms: rest, bonds, layout: placed, size });
}

export function layoutBuild({
  atoms,
  bonds,
  size = LAYOUT_SIZE,
}: {
  atoms: readonly { id: string }[];
  bonds: readonly LayoutBond[];
  size?: LayoutSize;
}): Layout {
  return relaxLayout({ bonds, layout: placeInTurn({ atoms, bonds, layout: {}, size }), size });
}
