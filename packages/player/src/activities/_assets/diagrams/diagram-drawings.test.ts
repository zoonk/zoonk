import { getDiagramParts } from "@zoonk/core/library/activities/diagrams";
import { describe, expect, it } from "vitest";
import { diagramDrawings } from "./diagram-drawings";
import { type DiagramPoint } from "./diagram-types";

type DiagramPartPlacement = { anchor: DiagramPoint; pin?: DiagramPoint };

/** Pins are 24px; at the narrowest canvas a drawing unit is a bit under a pixel. */
const MIN_PIN_GAP = 28;
const PIN_RADIUS = 11;

function pinOf(placement: DiagramPartPlacement): DiagramPoint {
  return placement.pin ?? placement.anchor;
}

function distance([x1, y1]: DiagramPoint, [x2, y2]: DiagramPoint): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

const drawings = Object.entries(diagramDrawings);

describe("diagram drawings", () => {
  it("draws each diagram with every part the catalog lists for it", () => {
    for (const [id, drawing] of drawings) {
      const catalogParts = getDiagramParts(id) ?? [];
      const shapedParts = new Set<string>(drawing.shapes.flatMap((shape) => shape.part ?? []));

      expect(Object.keys(drawing.parts).toSorted()).toStrictEqual([...catalogParts].toSorted());
      expect(catalogParts.filter((part) => !shapedParts.has(part))).toStrictEqual([]);
    }
  });

  it.each(drawings)(
    "paints each shape of %s once, so every shape has its own key",
    (_, drawing) => {
      const keys = drawing.shapes.map((shape) => `${shape.kind ?? "area"}:${shape.path}`);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it.each(drawings)(
    "keeps every pin of %s inside the drawing and clear of the others",
    (_, drawing) => {
      const pins = Object.values<DiagramPartPlacement>(drawing.parts).map((placement) =>
        pinOf(placement),
      );

      for (const [x, y] of pins) {
        expect(x).toBeGreaterThanOrEqual(PIN_RADIUS);
        expect(x).toBeLessThanOrEqual(drawing.width - PIN_RADIUS);
        expect(y).toBeGreaterThanOrEqual(PIN_RADIUS);
        expect(y).toBeLessThanOrEqual(drawing.height - PIN_RADIUS);
      }

      const tooClose = pins.flatMap((pin, index) =>
        pins.slice(index + 1).filter((other) => distance(pin, other) < MIN_PIN_GAP),
      );

      expect(tooClose).toStrictEqual([]);
    },
  );
});
