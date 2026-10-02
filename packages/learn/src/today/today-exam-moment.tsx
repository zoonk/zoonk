"use client";

import { ExamMomentCard } from "../exam/exam-moment-card";
import { useTodayScreen } from "./today-context";

/** An exam goal's moment on Today: the final stretch, the day before, the exam day, "How did it go?". */
export function TodayExamMoment() {
  const { actions, today } = useTodayScreen();

  if (!today.exam) {
    return null;
  }

  return <ExamMomentCard href={actions.examHref ?? null} moment={today.exam} />;
}
