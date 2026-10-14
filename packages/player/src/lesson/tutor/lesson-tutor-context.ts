import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type LearnBuddy } from "@zoonk/learn/tutor-identity";
import { type LessonQuestionConnection } from "../../questions/lesson-question-api";
import { type LessonQuestionNavigation } from "../../questions/lesson-question-navigation";

/**
 * The tutor in the lesson, supplied by the host: the resolved buddy who answers (null uses core's
 * default buddy), how to reach the questions API, its links and
 * notices, and whether this viewer may ask (signed-in learners; visitors and guests sign up first).
 */
export type LessonTutorConfig = {
  buddy: LearnBuddy | null;
  canAsk: boolean;
  connection: LessonQuestionConnection;
  navigation: LessonQuestionNavigation;
  /**
   * In a lesson, the tutor's suggestions for its screens from the lesson's payload, worded by the
   * server in the lesson's language (`wordTutorSuggestions`); none on other screens.
   */
  suggestions?: readonly LessonTutorSuggestion[];
};
