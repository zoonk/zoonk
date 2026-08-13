import { type Lesson } from "@zoonk/db";

/**
 * Legacy companion repair may fill only unowned incomplete rows. Running rows
 * belong to another workflow, while completed rows are immutable because
 * learner attempts may already reference their steps.
 */
export function isGeneratedCompanionRepairable(lesson: Lesson | null): lesson is Lesson {
  return lesson?.generationStatus === "pending" || lesson?.generationStatus === "failed";
}
