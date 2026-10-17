/**
 * The question in view of a session's block or of mistakes practice, as the learner's buddy is
 * asked about it: which one, the block it's asked in (null in practice), its words for the quote,
 * and whether it was checked and missed.
 */
export type TutorItem = {
  answered: boolean;
  blockId: string | null;
  itemId: string;
  missed: boolean;
  text: string;
};

/**
 * The learner's buddy for a run of questions, from the host (the player's tutor for a question):
 * `wrap` puts the conversation about the question in view around the run (null between questions,
 * and while asking would spoil the question, as a placement question or a timed drill's clock),
 * `button` asks beside the main action under `lg`, and `aside` docks the buddy in the aside from
 * `lg`. Opening it only reads the conversation; what the learner sends is answered.
 */
export type QuestionTutor = {
  aside: React.ReactNode;
  button: React.ReactNode;
  wrap: (item: TutorItem | null, children: React.ReactNode) => React.ReactNode;
};
