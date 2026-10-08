"use client";

import { type ReactNode, createContext, use, useState } from "react";
import { type CourseStartFailure, useCourseStart } from "./use-course-start";

type CourseStart = {
  chapterId?: string;
  courseId: string;
  failure: CourseStartFailure | null;
  pending: boolean;
  /** Starts the course from the control with this id, the one that then says why it didn't. */
  start: (controlId: string) => void;
  startedBy: string | null;
};

const CourseStartContext = createContext<CourseStart | null>(null);

/**
 * A course's or chapter's page has several start controls (the first screen's, the phone's bottom
 * bar and the closing call's) for one start. They share its state, so a refusal shown in one is
 * what every other one offers too, instead of a start that would be refused again.
 */
export function CourseStartProvider({
  chapterId,
  children,
  courseId,
}: {
  chapterId?: string;
  children: ReactNode;
  courseId: string;
}) {
  const { failure, pending, start } = useCourseStart({ chapterId, courseId });
  const [startedBy, setStartedBy] = useState<string | null>(null);

  const startFrom = (controlId: string) => {
    setStartedBy(controlId);
    start();
  };

  return (
    <CourseStartContext
      value={{ chapterId, courseId, failure, pending, start: startFrom, startedBy }}
    >
      {children}
    </CourseStartContext>
  );
}

export function useSharedCourseStart(): CourseStart {
  const courseStart = use(CourseStartContext);

  if (!courseStart) {
    throw new Error("A start button needs its page's CourseStartProvider.");
  }

  return courseStart;
}
