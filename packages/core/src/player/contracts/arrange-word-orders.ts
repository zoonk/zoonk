import { NO_SPACE_SCRIPT, normalizePunctuation } from "@zoonk/utils/string";
import {
  type ArrangeText,
  normalizeArrangeWord,
  segmentArrangeWords,
} from "./arrange-words-answers";

const SEPARATOR = "\u0000";

type Tile = { key: string; text: string };

function keyLength(tiles: readonly Tile[]): number {
  return tiles.reduce((length, tile) => length + tile.key.length, 0);
}

/**
 * The tiles that spell each piece (text between spaces) in order, each tile used once, or null. A
 * piece is one tile or, in a script written without spaces, several; a piece of punctuation alone
 * spells nothing. `spelling` holds the tiles already spelling the first piece.
 */
function spellWithTiles({
  pieces,
  spelling = [],
  tiles,
}: {
  pieces: readonly Tile[];
  spelling?: readonly Tile[];
  tiles: readonly Tile[];
}): Tile[][] | null {
  const [piece, ...rest] = pieces;

  if (!piece) {
    return tiles.length === 0 ? [] : null;
  }

  const left = piece.key.slice(keyLength(spelling));

  if (!left) {
    const after = spellWithTiles({ pieces: rest, tiles });
    return after && spelling.length > 0 ? [[...spelling], ...after] : after;
  }

  const allowJoinedTiles = NO_SPACE_SCRIPT.test(piece.text);

  for (const [index, tile] of tiles.entries()) {
    const spelled =
      tile.key && (allowJoinedTiles ? left.startsWith(tile.key) : left === tile.key)
        ? spellWithTiles({
            pieces,
            spelling: [...spelling, tile],
            tiles: tiles.toSpliced(index, 1),
          })
        : null;

    if (spelled) {
      return spelled;
    }
  }

  return null;
}

function toTile(word: string): Tile {
  return { key: normalizeArrangeWord(word), text: word };
}

function toOrderKey(tiles: readonly Tile[]): string {
  return tiles.map((tile) => tile.key).join(SEPARATOR);
}

/**
 * Keeps the other orders a learner can build with the text's own tiles, as its screen splits and
 * compares them, each order once. A piece of an order spelled by several tiles (Japanese, which the
 * screen splits by context) is written as those tiles between spaces, so splitting the kept order as
 * the screen does gives back exactly its tiles.
 */
export function keepOtherArrangeOrders({
  kind,
  orders,
  text,
}: ArrangeText & { orders: readonly string[] }): string[] {
  const tiles = segmentArrangeWords({ kind, text }).map((word) => toTile(word));

  if (tiles.some((tile) => !tile.key)) {
    return [];
  }

  const seen = new Set([toOrderKey(tiles)]);

  return orders.flatMap((order) => {
    const pieces = normalizePunctuation(order)
      .split(/\s+/u)
      .map((piece) => toTile(piece));

    const spelled = spellWithTiles({ pieces, tiles });
    const key = spelled && toOrderKey(spelled.flat());

    if (!spelled || !key || seen.has(key)) {
      return [];
    }

    seen.add(key);

    return [
      spelled
        .flat()
        .map((tile) => tile.text)
        .join(" "),
    ];
  });
}
