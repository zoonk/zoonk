import { type Pan } from "./balance-model";

const BAG_WIDTH = 34;
export const BAG_HEIGHT = 44;
export const BLOCK_SIZE = 22;
export const WEIGHT_WIDTH = 52;
export const WEIGHT_HEIGHT = 30;

const BAG_STEP = BAG_WIDTH + 2;
const BLOCK_STEP = BLOCK_SIZE + 1;
const MIN_STACK = 3;
const GROUP_GAP = 6;
const MAX_WHOLE_BLOCKS = 12;

/** A drawn item's top-left corner, measured from the plate's left edge and top (y grows up). */
type ItemPosition = { x: number; y: number };

export type PanLayout = {
  bags: ItemPosition[];
  blocks: ItemPosition[];
  height: number;
  /** A single weight with its value, for units that aren't a few whole blocks (like 3.5). */
  weight: ItemPosition | null;
};

function isWholeBlocks(units: number): boolean {
  return Number.isInteger(units) && units >= 0 && units <= MAX_WHOLE_BLOCKS;
}

/** Block stacks get taller before bags wrap, so a pan keeps one row of bags when it can. */
const STACK_HEIGHTS = [MIN_STACK, MIN_STACK + 1, MIN_STACK + 2] as const;

function unitsWidth(pan: Pan, stack: number): number {
  if (pan.units <= 0) {
    return 0;
  }

  return (
    (isWholeBlocks(pan.units) ? Math.ceil(pan.units / stack) * BLOCK_STEP : WEIGHT_WIDTH) +
    GROUP_GAP
  );
}

function blockPositions({ count, left, stack }: { count: number; left: number; stack: number }) {
  return Array.from({ length: count }, (_, index) => ({
    x: left + Math.floor(index / stack) * BLOCK_STEP,
    y: ((index % stack) + 1) * BLOCK_STEP,
  }));
}

/**
 * Where bags and blocks sit on a pan: bags side by side from the left, blocks stacked in short
 * columns next to them, so both groups rest on the plate and the pan reads at a glance. Stacks
 * grow taller before bags wrap to a second row.
 */
export function panLayout(pan: Pan, width: number): PanLayout {
  const bagCount = Number.isInteger(pan.x) && pan.x > 0 ? pan.x : 0;

  const stack = STACK_HEIGHTS.find(
    (height) => bagCount * BAG_STEP + unitsWidth(pan, height) <= width,
  );

  const blockStack = stack ?? MIN_STACK;
  const bagSpace = Math.floor((width - unitsWidth(pan, blockStack)) / BAG_STEP);
  const bagColumns = Math.max(Math.min(bagCount, stack === undefined ? bagSpace : bagCount), 1);
  const bagRows = Math.ceil(bagCount / bagColumns);
  const unitsLeft = bagCount > 0 ? Math.min(bagColumns, bagCount) * BAG_STEP + GROUP_GAP : 0;
  const blockCount = isWholeBlocks(pan.units) ? pan.units : 0;

  const bags = Array.from({ length: bagCount }, (_, index) => ({
    x: (index % bagColumns) * BAG_STEP,
    y: (Math.floor(index / bagColumns) + 1) * BAG_HEIGHT,
  }));

  const blocks = blockPositions({ count: blockCount, left: unitsLeft, stack: blockStack });

  const weight =
    !isWholeBlocks(pan.units) && pan.units > 0 ? { x: unitsLeft, y: WEIGHT_HEIGHT } : null;

  const heights = [bagRows * BAG_HEIGHT, ...blocks.map((block) => block.y), weight?.y ?? 0];

  return { bags, blocks, height: Math.max(...heights), weight };
}
