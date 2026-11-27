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

/** Keep `target` stable across renders because tutor requests follow its identity. */
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
