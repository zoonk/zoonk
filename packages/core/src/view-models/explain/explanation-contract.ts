import { type PlayableLibraryLesson } from "../../lesson-player/contract";

/** Navigate by slugs; Build a plan uses the course id with POST /v1/courses/{courseId}/goals. */
type ExplanationCourse = {
  brandSlug: string;
  chapterCount: number;
  courseSlug: string;
  description: string | null;
  id: string;
  title: string;
};

/** lesson excludes the summary card, which becomes recap; null while status is preparing. */
export type ExplanationView = {
  goFurther: { course: ExplanationCourse | null; questions: string[] };
  /** The run writing the explanation, to follow live; null until it starts. */
  generationId: string | null;
  goalId: string;
  /** With no other study goal, the next step is another question rather than returning to a plan. */
  hasStudyGoal: boolean;
  lesson: PlayableLibraryLesson | null;
  /** Story-screen titles in display order. */
  outline: string[];
  question: string;
  recap: string[];
  status: "preparing" | "ready";
  title: string;
};
