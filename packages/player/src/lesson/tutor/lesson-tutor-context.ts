import { type LessonQuestionConnection } from "../../questions/lesson-question-api";
import { type LessonQuestionNavigation } from "../../questions/lesson-question-navigation";

/**
 * The tutor in the lesson, supplied by the host: how to reach the questions API, its links and
 * notices, and whether this viewer may ask (signed-in learners; visitors and guests sign up first).
 */
export type LessonTutorConfig = {
  canAsk: boolean;
  connection: LessonQuestionConnection;
  navigation: LessonQuestionNavigation;
};
