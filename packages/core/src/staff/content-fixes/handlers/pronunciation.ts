import { sql } from "@zoonk/db";
import { z } from "zod";
import { sharedRowHandler } from "./shared-row";

export const pronunciationSet = sharedRowHandler({
  fields: { pronunciation: z.string().trim().min(1), tip: z.string().trim().min(1).nullable() },
  load: async (db, id) => {
    const row = await db.wordPronunciation.findUnique({
      select: { pronunciation: true, tip: true, wordId: true },
      where: { id },
    });

    return (
      row && {
        row: { pronunciation: row.pronunciation, tip: row.tip },
        unit: { id: row.wordId, kind: "word" },
      }
    );
  },
  model: "WordPronunciation",
  rules:
    "A word's guide to saying it in one learner language, and its tip (null when there's no trap). Fixed with its word, in the same fix when the word's text changes.",
  table: sql`word_pronunciations`,
  write: (tx, id, values) =>
    tx.wordPronunciation.update({
      data: z
        .object({ pronunciation: z.string().optional(), tip: z.string().nullable().optional() })
        .parse(values),
      where: { id },
    }),
});
