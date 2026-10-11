import { parseCefrScore } from "@zoonk/utils/cefr";
import { type LevelEvidence } from "../levels/skill-level-rules";
import { type ExamSpeakingFeedback, type ExamTaskSnapshot } from "./speaking-contract";
import { getSpeakingFormat } from "./speaking-formats";
import { getLevelMark, getLevelStanding } from "./speaking-standing";

/**
 * An exam task as evidence of the learner's speaking level, at the exam's level: each criterion
 * whose estimate sits at the level's band or above counts as right, the others as wrong. Doing the
 * task alone says nothing, so a task with no grade (the learner said nothing) gives no evidence.
 */
export function getExamTaskEvidence({
  feedback,
  snapshot,
}: {
  feedback: ExamSpeakingFeedback | null;
  snapshot: ExamTaskSnapshot;
}): LevelEvidence | null {
  const format = getSpeakingFormat(snapshot);
  const ceiling = parseCefrScore(snapshot.level);

  if (!feedback || !format || ceiling === null) {
    return null;
  }

  const rated = feedback.criteria.flatMap((grade) => {
    const criterion = format.criteria.find((item) => item.key === grade.criterion);
    return criterion ? [{ criterion, grade }] : [];
  });

  if (rated.length === 0) {
    return null;
  }

  const correct = rated.filter(
    ({ criterion, grade }) =>
      getLevelStanding({ ...grade, levelMark: getLevelMark(criterion) }) === "at",
  ).length;

  return { ceiling, correct, total: rated.length };
}
