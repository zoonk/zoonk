import { type Goal } from "@zoonk/db";
import { hasSpeakingPaper } from "../../../language/exam-speaking/_utils/exam-speaking-setup";
import { hasMindMapsPage } from "../../../mind-maps/mind-map-contract";
import { type LearnerSummaryGoal, type LearnerSummaryPlaces } from "../learner-summary-contract";
import { type LearnerFacts } from "./load-learner-facts";

export function getPlaces({
  activeGoal,
  facts,
  goal,
  readyMistakes,
}: {
  activeGoal: Goal | null;
  facts: LearnerFacts;
  goal: LearnerSummaryGoal | null;
  readyMistakes: number;
}): LearnerSummaryPlaces {
  if (!goal || !activeGoal) {
    return {
      certificates: facts.hasCertificates,
      completedLessons: false,
      exam: false,
      mindMaps: false,
      readyMistakes: 0,
      savedLessons: false,
      speaking: false,
    };
  }

  const speakingScore = activeGoal.targetLanguage
    ? (facts.speakingScores[activeGoal.targetLanguage] ?? null)
    : null;

  return {
    certificates: facts.hasCertificates,
    completedLessons: facts.completedLessonGoalIds.includes(goal.id),
    exam: goal.kind === "exam",
    mindMaps: hasMindMapsPage(goal.kind),
    readyMistakes,
    savedLessons: facts.savedLessonGoalIds.includes(goal.id),
    speaking: hasSpeakingPaper({
      blueprintName: facts.blueprintNames[activeGoal.id] ?? null,
      goal: activeGoal,
      speakingScore,
    }),
  };
}
