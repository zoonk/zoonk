import { cn } from "@zoonk/ui/lib/utils";
import {
  BAG_HEIGHT,
  BLOCK_SIZE,
  type PanLayout,
  WEIGHT_HEIGHT,
  WEIGHT_WIDTH,
  panLayout,
} from "./balance-layout";
import { type BalanceState, type Pan } from "./balance-model";

const VIEW_WIDTH = 350;
const VIEW_BOTTOM = 250;
const PIVOT_X = 175;
const PIVOT_Y = 205;
const ARM = 95;
const PLATE_WIDTH = 156;
const PLATE_HEIGHT = 7;
const PLATE_LIFT = 22;
const PAN_PADDING = 6;
const ITEMS_WIDTH = PLATE_WIDTH - PAN_PADDING * 2;
const HEAVIER_OFFSET = 34;
const WEIGHT_TEXT_OFFSET = 5;
const STAND_HALF_WIDTH = 18;
const STAND_HEIGHT = 38;
const BASE_HALF_WIDTH = 37;
const DEGREES_PER_HALF_TURN = 180;
const MAX_TILT_LIFT = 16;
const TOP_MARGIN = 8;
const BAG_SYMBOL_X = 17;
const BAG_SYMBOL_Y = 32;

/** A rice bag drawn in a 34 by 44 box, with room for its symbol. */
const BAG_PATH =
  "M13 2 H21 L19.5 8 C26 10 33 16 33 26 C33 37 26 43 17 43 C8 43 1 37 1 26 C1 16 8 10 14.5 8 Z";

const TRANSITION = "motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out";

function PanItems({
  formatUnits,
  layout,
  pan,
  symbol,
}: {
  formatUnits: (value: number) => string;
  layout: PanLayout;
  pan: Pan;
  symbol: string;
}) {
  return (
    <g>
      {layout.bags.map((bag) => (
        <g key={`${bag.x}-${bag.y}`} transform={`translate(${bag.x} ${-bag.y})`}>
          <path className="fill-viz-accent" d={BAG_PATH} />
          <text
            className="fill-background text-sm font-bold"
            textAnchor="middle"
            x={BAG_SYMBOL_X}
            y={BAG_SYMBOL_Y}
          >
            {symbol}
          </text>
        </g>
      ))}

      {layout.blocks.map((block) => (
        <rect
          className="fill-viz-highlight stroke-background"
          height={BLOCK_SIZE}
          key={`${block.x}-${block.y}`}
          rx={4}
          strokeWidth={1.5}
          width={BLOCK_SIZE}
          x={block.x}
          y={-block.y}
        />
      ))}

      {layout.weight && (
        <g transform={`translate(${layout.weight.x} ${-layout.weight.y})`}>
          <rect className="fill-viz-highlight" height={WEIGHT_HEIGHT} rx={6} width={WEIGHT_WIDTH} />
          <text
            className="fill-background text-sm font-bold"
            textAnchor="middle"
            x={WEIGHT_WIDTH / 2}
            y={WEIGHT_HEIGHT / 2 + WEIGHT_TEXT_OFFSET}
          >
            {formatUnits(pan.units)}
          </text>
        </g>
      )}
    </g>
  );
}

function PanGroup({
  center,
  dy,
  formatUnits,
  heavierLabel,
  isHeavier,
  pan,
  symbol,
}: {
  center: number;
  dy: number;
  formatUnits: (value: number) => string;
  heavierLabel: string;
  isHeavier: boolean;
  pan: Pan;
  symbol: string;
}) {
  const plateY = PIVOT_Y - PLATE_LIFT;

  return (
    <g className={TRANSITION} style={{ transform: `translateY(${dy}px)` }}>
      <path
        className="stroke-muted-foreground"
        d={`M${center} ${PIVOT_Y} V${plateY}`}
        strokeWidth={3.5}
      />
      <rect
        className="fill-foreground/70"
        height={PLATE_HEIGHT}
        rx={PLATE_HEIGHT / 2}
        width={PLATE_WIDTH}
        x={center - PLATE_WIDTH / 2}
        y={plateY - PLATE_HEIGHT}
      />
      <g
        transform={`translate(${center - PLATE_WIDTH / 2 + PAN_PADDING} ${plateY - PLATE_HEIGHT})`}
      >
        <PanItems
          formatUnits={formatUnits}
          layout={panLayout(pan, ITEMS_WIDTH)}
          pan={pan}
          symbol={symbol}
        />
      </g>
      {isHeavier && (
        <text
          className="fill-destructive text-sm font-semibold"
          textAnchor="middle"
          x={center}
          y={PIVOT_Y + HEAVIER_OFFSET}
        >
          {heavierLabel}
        </text>
      )}
    </g>
  );
}

/** The drawing starts just above the tallest pan the activity can show, so it never jumps. */
function viewTop(frame: BalanceState): number {
  const tallest = Math.max(
    panLayout(frame.left, ITEMS_WIDTH).height,
    panLayout(frame.right, ITEMS_WIDTH).height,
    BAG_HEIGHT,
  );

  return PIVOT_Y - PLATE_LIFT - PLATE_HEIGHT - tallest - MAX_TILT_LIFT - TOP_MARGIN;
}

/**
 * The balance itself: a beam that tips toward the heavier pan, with bags for the unknown and
 * blocks for units. It's a picture of the state the controls change, so it's hidden from screen
 * readers; the canvas's text alternative says what's on each pan and which side is heavier.
 */
export function BalanceScale({
  className,
  formatUnits,
  frame,
  heavierLabel,
  state,
  symbol,
  tilt,
}: {
  className?: string;
  formatUnits: (value: number) => string;
  /** The starting pans, which size the drawing. */
  frame: BalanceState;
  heavierLabel: string;
  state: BalanceState;
  symbol: string;
  tilt: number;
}) {
  const lift = Math.sin((tilt * Math.PI) / DEGREES_PER_HALF_TURN) * ARM;
  const top = viewTop(frame);

  return (
    <svg
      aria-hidden="true"
      className={cn("mx-auto w-full max-w-sm", className)}
      viewBox={`0 ${top} ${VIEW_WIDTH} ${VIEW_BOTTOM - top}`}
    >
      <path
        className="fill-muted-foreground/60"
        d={`M${PIVOT_X} ${PIVOT_Y} L${PIVOT_X - STAND_HALF_WIDTH} ${PIVOT_Y + STAND_HEIGHT} H${PIVOT_X + STAND_HALF_WIDTH} Z`}
      />
      <rect
        className="fill-muted-foreground"
        height={PLATE_HEIGHT}
        rx={PLATE_HEIGHT / 2}
        width={BASE_HALF_WIDTH * 2}
        x={PIVOT_X - BASE_HALF_WIDTH}
        y={PIVOT_Y + STAND_HEIGHT}
      />

      <g
        className={TRANSITION}
        style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px` }}
      >
        <path
          className="stroke-muted-foreground"
          d={`M${PIVOT_X - ARM} ${PIVOT_Y} H${PIVOT_X + ARM}`}
          strokeLinecap="round"
          strokeWidth={PLATE_HEIGHT}
        />
      </g>

      <PanGroup
        center={PIVOT_X - ARM}
        dy={-lift}
        formatUnits={formatUnits}
        heavierLabel={heavierLabel}
        isHeavier={tilt < 0}
        pan={state.left}
        symbol={symbol}
      />
      <PanGroup
        center={PIVOT_X + ARM}
        dy={lift}
        formatUnits={formatUnits}
        heavierLabel={heavierLabel}
        isHeavier={tilt > 0}
        pan={state.right}
        symbol={symbol}
      />
      <circle className="fill-foreground" cx={PIVOT_X} cy={PIVOT_Y} r={PLATE_HEIGHT} />
    </svg>
  );
}
