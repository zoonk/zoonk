import { type LearnBuddy } from "@zoonk/learn/tutor-identity";
import { type LessonQuestionConnection } from "../../questions/lesson-question-api";
import { type LessonQuestionNavigation } from "../../questions/lesson-question-navigation";

/**
 * The tutor in the lesson, supplied by the host: the learner's buddy who answers (null before
 * they pick one: a neutral "Buddy" answers), how to reach the questions API, its links and
 * notices, and whether this viewer may ask (signed-in learners; visitors and guests sign up first).
 */
export type LessonTutorConfig = {
  buddy: LearnBuddy | null;
  canAsk: boolean;
  connection: LessonQuestionConnection;
  navigation: LessonQuestionNavigation;
};
