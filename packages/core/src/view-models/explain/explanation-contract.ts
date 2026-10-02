import { type PlayableLibraryLesson } from "../../lesson-player/contract";

/**
 * The course "Want to go further?" leads into: the subject's Overview. Its page opens from the
 * slugs; "Build a plan" starts it by `id` (`POST /v1/courses/{courseId}/goals`).
 */
type ExplanationCourse = {
  brandSlug: string;
  chapterCount: number;
  courseSlug: string;
  description: string | null;
  id: string;
  title: string;
};

/**
 * A quick explanation as both modes show it. `lesson` holds the story screens and the check,
 * without the summary card, which is `recap` ("Now you know"). It's null while the explanation is
 * being written (`preparing`).
 */
export type ExplanationView = {
  goFurther: { course: ExplanationCourse | null; questions: string[] };
  /** The run writing the explanation, to follow live; null until it starts. */
  generationId: string | null;
  goalId: string;
  lesson: PlayableLibraryLesson | null;
  /** The story screens' titles, in order, once it's written. */
  outline: string[];
  /** The learner's question, as they asked it. */
  question: string;
  recap: string[];
  status: "preparing" | "ready";
  /** The explanation's title, such as "How a microwave works". */
  title: string;
};
