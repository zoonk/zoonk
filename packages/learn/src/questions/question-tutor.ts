import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";

export type TutorItem = {
  lesson?: { id: string; stepId: string; mistakeId: string; answer: LessonStepAnswer | null };
  answered: boolean;
  blockId: string | null;
  itemId: string;
  missed: boolean;
  mistakeId?: string;
  position: number;
  text: string;
};

/**
 * `wrap` is null between questions and while asking would spoil the question (placement, a timed
 * drill's clock). Opening it only reads the conversation.
 */
export type QuestionTutor = {
  aside: React.ReactNode;
  asideMeta: (meta: React.ReactNode) => React.ReactNode;
  button: React.ReactNode;
  wrap: (item: TutorItem | null, children: React.ReactNode) => React.ReactNode;
};
