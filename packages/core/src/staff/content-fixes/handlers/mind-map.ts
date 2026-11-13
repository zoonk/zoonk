import { mindMapStructureSchema } from "@zoonk/ai/tasks/mind-maps/schema";
import { sql } from "@zoonk/db";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
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
          (row.status === "completed" || row.status === "failed"
            ? undefined
            : "Wait for the current mind-map run before fixing its text."),
        row: { structure: toJson(row.structure) },
        unit: { id: row.chapterId, kind: "chapter" },
      }
    );
  },
  model: "ChapterMindMap",
  rules:
    "Completed or failed maps of public chapters only. Keep branches, points, comparison columns and drawing descriptions. The outline changes and a durable workflow redraws the picture; old readers keep their copy.",
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
  write: async (tx, id, values, context) => {
    const row = await tx.chapterMindMap.update({
      data: {
        imageHeight: null,
        imageUrl: null,
        imageWidth: null,
        status: "pending",
        structure: mindMapStructureSchema.parse(values.structure),
        thumbnailUrl: null,
      },
      where: { id },
    });

    const fix = await tx.contentFix.findUniqueOrThrow({
      select: { deciderId: true },
      where: { id: context.fixId },
    });

    if (!fix.deciderId) {
      throw new Error("A redraw needs the staff approver.");
    }

    await oweFollowUps({
      db: tx,
      followUps: [
        { input: { chapterId: row.chapterId, fixId: context.fixId }, kind: "redrawChapterMindMap" },
      ],
      userId: fix.deciderId,
    });
  },
});
