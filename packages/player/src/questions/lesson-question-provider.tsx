"use client";

import { type ReactNode, createContext, useContext } from "react";
import { PlayerQuestionSupportContext } from "../player-context";
import { type LessonQuestionConnection } from "./lesson-question-api";
import { type LessonQuestionController, useLessonQuestions } from "./use-lesson-questions";

const LessonQuestionContext = createContext<LessonQuestionController | null>(null);

export function LessonQuestionProvider({
  children,
  connection,
  lessonId,
}: {
  children: ReactNode;
  connection: LessonQuestionConnection;
  lessonId: string;
}) {
  const controller = useLessonQuestions({ connection, lessonId });

  return (
    <LessonQuestionContext value={controller}>
      <PlayerQuestionSupportContext value={controller.questionSupport}>
        {children}
      </PlayerQuestionSupportContext>
    </LessonQuestionContext>
  );
}

export function useLessonQuestionController(): LessonQuestionController {
  const controller = useContext(LessonQuestionContext);

  if (!controller) {
    throw new Error("useLessonQuestionController must be used within a LessonQuestionProvider");
  }

  return controller;
}
