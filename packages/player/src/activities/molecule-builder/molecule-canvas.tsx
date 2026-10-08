"use client";

import { valenceOf } from "@zoonk/core/library/activities/chemistry";
import { cn } from "@zoonk/ui/lib/utils";
import { elementStyle } from "./element-style";
import { ATOM_RADIUS, LAYOUT_SIZE, type Layout, type LayoutPoint } from "./molecule-layout";
import { type Build, type BuildAtom, type BuildBond, atomFill, bondsUsed } from "./molecule-model";

const BOND_GAP = 5;
const OPEN_DOT_RADIUS = 4.5;
const OPEN_DOT_OFFSET = 9;
const OPEN_DOT_DISTANCE = ATOM_RADIUS + OPEN_DOT_OFFSET;
const THIN_RING = 1.5;
const STATUS_RING = 3;
const OPEN_DOT_SPREAD = 28;
const OPEN_DOT_START = -90;
const DEGREES = 180;
const RING_GAP = 4;
const LETTER_SIZE = 17;

function BondLines({ bond, from, to }: { bond: BuildBond; from: LayoutPoint; to: LayoutPoint }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const [nx, ny] = [-(to.y - from.y) / length, (to.x - from.x) / length];

  const offsets = Array.from(
    { length: bond.order },
    (_, index) => (index - (bond.order - 1) / 2) * BOND_GAP * 2,
  );

  return (
    <g className="stroke-foreground/75" strokeLinecap="round" strokeWidth={3}>
      {offsets.map((offset) => (
        <line
          key={offset}
          x1={from.x + nx * offset}
          x2={to.x + nx * offset}
          y1={from.y + ny * offset}
          y2={to.y + ny * offset}
        />
      ))}
    </g>
  );
}

/** Small dots around an atom, one per bond it still needs. */
function OpenBonds({ count }: { count: number }) {
  return (
    <g className="fill-warning stroke-background" strokeWidth={1.5}>
      {Array.from({ length: count }, (_, index) => {
        const angle = ((OPEN_DOT_START + index * OPEN_DOT_SPREAD) * Math.PI) / DEGREES;

        return (
          <circle
            cx={OPEN_DOT_DISTANCE * Math.cos(angle)}
            cy={OPEN_DOT_DISTANCE * Math.sin(angle)}
            key={index}
            r={OPEN_DOT_RADIUS}
          />
        );
      })}
    </g>
  );
}

function AtomFace({
  atom,
  build,
  isSelected,
}: {
  atom: BuildAtom;
  build: Build;
  isSelected: boolean;
}) {
  const style = elementStyle(atom.element);
  const fill = atomFill(build, atom);
  const open = Math.max(valenceOf(atom.element) - bondsUsed(build, atom.id), 0);

  return (
    <>
      <circle
        className="stroke-ring fill-none opacity-0 group-focus-visible:opacity-100"
        r={ATOM_RADIUS + RING_GAP * 2}
        strokeWidth={2.5}
      />
      {isSelected && (
        <circle
          className="fill-viz-accent/20 stroke-viz-accent"
          r={ATOM_RADIUS + RING_GAP}
          strokeWidth={3}
        />
      )}
      <circle
        className={cn(
          style.fill,
          fill === "open" && "stroke-foreground/25",
          fill === "full" && "stroke-success",
          fill === "over" && "stroke-destructive",
        )}
        r={ATOM_RADIUS}
        strokeWidth={fill === "open" ? THIN_RING : STATUS_RING}
      />
      <text
        className={cn(style.text, "font-bold select-none")}
        dominantBaseline="central"
        fontSize={LETTER_SIZE}
        textAnchor="middle"
      >
        {atom.element}
      </text>
      <OpenBonds count={open} />
    </>
  );
}

const FIT_MARGIN = 14;
const FIT_PADDING = ATOM_RADIUS + FIT_MARGIN;

/** A view box around the atoms with room for their rings and open-bond dots. */
function fittedViewBox(layout: Layout): string {
  const points = Object.values(layout);

  if (points.length === 0) {
    return `0 0 ${LAYOUT_SIZE.width} ${LAYOUT_SIZE.height}`;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [left, top] = [Math.min(...xs) - FIT_PADDING, Math.min(...ys) - FIT_PADDING];
  const [right, bottom] = [Math.max(...xs) + FIT_PADDING, Math.max(...ys) + FIT_PADDING];

  return `${left} ${top} ${right - left} ${bottom - top}`;
}

/**
 * A build drawn as atoms and bonds. With `onAtomPress` each atom is a button (tap or Enter to
 * select it, then another to bond them); without it the drawing is a picture for after the check.
 */
export function MoleculeCanvas({
  atomLabel,
  build,
  className,
  description,
  fit = false,
  layout,
  onAtomPress,
  selectedId,
}: {
  atomLabel: (atom: BuildAtom) => string;
  build: Build;
  className?: string;
  /** What a read-only drawing shows, for screen readers. */
  description?: string;
  /** Crops the drawing to its atoms, for a compact picture instead of the whole work area. */
  fit?: boolean;
  layout: Layout;
  onAtomPress?: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <svg
      aria-label={onAtomPress ? undefined : description}
      className={cn("mx-auto block h-auto w-full max-w-[400px] overflow-visible", className)}
      role={onAtomPress ? "group" : "img"}
      viewBox={fit ? fittedViewBox(layout) : `0 0 ${LAYOUT_SIZE.width} ${LAYOUT_SIZE.height}`}
    >
      {build.bonds.map((bond) => {
        const [from, to] = [layout[bond.from], layout[bond.to]];

        return from && to ? (
          <BondLines bond={bond} from={from} key={`${bond.from}-${bond.to}`} to={to} />
        ) : null;
      })}

      {build.atoms.map((atom) => {
        const point = layout[atom.id];

        if (!point) {
          return null;
        }

        const face = <AtomFace atom={atom} build={build} isSelected={selectedId === atom.id} />;

        return onAtomPress ? (
          <g
            aria-label={atomLabel(atom)}
            aria-pressed={selectedId === atom.id}
            className="group cursor-pointer outline-none"
            key={atom.id}
            onClick={() => onAtomPress(atom.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onAtomPress(atom.id);
              }
            }}
            role="button"
            tabIndex={0}
            transform={`translate(${point.x} ${point.y})`}
          >
            {face}
          </g>
        ) : (
          <g aria-hidden="true" key={atom.id} transform={`translate(${point.x} ${point.y})`}>
            {face}
          </g>
        );
      })}
    </svg>
  );
}
