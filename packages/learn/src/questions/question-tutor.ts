export type TutorItem = {
  answered: boolean;
  blockId: string | null;
  itemId: string;
  missed: boolean;
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
