import { mindMapStructureSchema } from "@zoonk/ai/tasks/mind-maps/schema";
import { sql } from "@zoonk/db";
import { after as afterResponse } from "next/server";
import { startMindMapRedraw } from "../../../follow-ups/follow-up-starter";
import { isMindMapRunActive } from "../../../mind-maps/_utils/mind-map-view";
import { PRIVATE_CONTENT, toJson } from "../_utils/resolved-change";
import { sharedRowHandler } from "./shared-row";

export const mindMapSet = sharedRowHandler({
  effects: (unit) => [{ chapterId: unit.id, kind: "mindMapRedrawOwed" }],
  fields: { structure: mindMapStructureSchema },
  load: async (db, id) => {
    const row = await db.chapterMindMap.findUnique({
      include: { chapter: { select: { ownerId: true, visibility: true } } },
      where: { id },
    });

    return (
      row && {
        problem:
          (row.chapter.ownerId || row.chapter.visibility !== "public"
            ? PRIVATE_CONTENT
            : undefined) ||
          (row.status === "running" && isMindMapRunActive({ now: new Date(), row })
            ? "Wait for the current mind-map run before fixing its text."
            : undefined),
        row: { structure: toJson(row.structure) },
        unit: { id: row.chapterId, kind: "chapter" },
      }
    );
  },
  model: "ChapterMindMap",
  rules:
    "Non-running maps of public chapters only. Keep branches, points, comparison columns and drawing descriptions. The outline changes and a durable workflow redraws the picture; old readers keep their copy.",
  table: sql`chapter_mind_maps`,
  validate: (row, next) => {
    const before = mindMapStructureSchema.safeParse(row.structure);
    const after = mindMapStructureSchema.parse(next.structure);

    if (!before.success) {
      return "The stored map must have a valid structure.";
    }

    const shape = (map: typeof after) =>
      JSON.stringify([
        map.branches.map((branch) => [branch.drawing, branch.points.length]),
        map.comparison?.columns.map((column) => column.points.length) ?? null,
      ]);

    return shape(before.data) === shape(after)
      ? null
      : "Keep the map's structure and drawing descriptions.";
  },
  write: async (tx, id, values) => {
    const row = await tx.chapterMindMap.update({
      data: {
        imageHeight: null,
        imageUrl: null,
        imageWidth: null,
        redrawAttemptedAt: null,
        redrawOwedAt: new Date(),
        runId: null,
        status: "completed",
        structure: mindMapStructureSchema.parse(values.structure),
        thumbnailUrl: null,
      },
      where: { id },
    });

    afterResponse(() => startMindMapRedraw(row.chapterId));
  },
});
