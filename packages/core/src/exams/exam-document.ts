import { type Goal } from "@zoonk/db";
import { z } from "zod";

/**
 * What an exam's official documents are, so screens name them as its candidates do: `notice` for
 * an exam a public notice announces (a public-service or entrance exam's edital), `guide` for a
 * language certificate, whose board publishes an official guide and site instead (DELE, IELTS).
 */
export const examDocumentSchema = z
  .enum(["guide", "notice"])
  .meta({
    description:
      "What the exam's official documents are: `notice` for an exam a public notice announces, `guide` for a language certificate's official guide and site",
    id: "ExamDocument",
  });

export type ExamDocument = z.infer<typeof examDocumentSchema>;

/**
 * The goal's exam documents: a language certificate's (an exam goal testing a language, which
 * onboarding gives its draft and the goal) are its official guide, any other exam's its notice.
 */
export function getExamDocument(
  goal: Pick<Goal, "kind"> & { targetLanguage?: string | null },
): ExamDocument {
  return goal.kind === "exam" && goal.targetLanguage ? "guide" : "notice";
}
