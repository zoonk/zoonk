import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type LearnBuddy } from "@zoonk/learn/tutor-identity";
import { type LessonQuestionConnection } from "../../questions/lesson-question-api";
import { type LessonQuestionNavigation } from "../../questions/lesson-question-navigation";

export type LessonTutorConfig = {
  buddy: LearnBuddy | null;
  canAsk: boolean;
  connection: LessonQuestionConnection;
  navigation: LessonQuestionNavigation;
  suggestions?: readonly LessonTutorSuggestion[];
};
