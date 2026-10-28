import { type Goal } from "@zoonk/db";
import { z } from "zod";

export const examDocumentSchema = z
  .enum(["guide", "notice"])
  .meta({
    description:
      "What the exam's official documents are: `notice` for an exam a public notice announces, `guide` for a language certificate's official guide and site",
    id: "ExamDocument",
  });

export type ExamDocument = z.infer<typeof examDocumentSchema>;

export function getExamDocument(
  goal: Pick<Goal, "kind"> & { targetLanguage?: string | null },
): ExamDocument {
  return goal.kind === "exam" && goal.targetLanguage ? "guide" : "notice";
}
