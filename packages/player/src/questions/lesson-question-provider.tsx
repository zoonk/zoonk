"use client";

import { type TutorTarget } from "@zoonk/core/lesson-questions/contract";
import { type ReactNode, createContext, useContext } from "react";
import { PlayerInteractionContext } from "../player-context";
import { type LessonQuestionConnection } from "./lesson-question-api";
import {
  type LessonQuestionController,
  type LessonQuestionHost,
  useLessonQuestions,
} from "./use-lesson-questions";

const LessonQuestionContext = createContext<LessonQuestionController | null>(null);

/**
 * The tutor for any host: the host says what the thread is about (a lesson, chapter, plan or
 * mock), where the learner is and whether they may ask, and the tutor's controller reaches the
 * panel and the questions actions through context. Keep `target` stable across renders.
 */
export function LessonQuestionHostProvider({
  children,
  connection,
  host,
  target,
}: {
  children: ReactNode;
  connection: LessonQuestionConnection;
  host: LessonQuestionHost;
  target: TutorTarget;
}) {
  const controller = useLessonQuestions({ ...host, connection, target });

  return (
    <LessonQuestionContext value={controller}>
      <PlayerInteractionContext value={controller.state.isOpen ? "paused" : "active"}>
        {children}
      </PlayerInteractionContext>
    </LessonQuestionContext>
  );
}

export function useLessonQuestionController(): LessonQuestionController {
  const controller = useContext(LessonQuestionContext);

  if (!controller) {
    throw new Error("useLessonQuestionController must be used within a LessonQuestionHostProvider");
  }

  return controller;
}
