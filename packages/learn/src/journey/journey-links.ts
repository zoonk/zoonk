/** Where the Journey's path leads: each chapter's page, a phase's challenge and the exam's page. */
export type JourneyPathLinks = {
  chapter: (chapterId: string) => string;
  challenge: (planItemId: string) => string;
  /** An exam goal's "About the exam", the path's finish; null for other goals. */
  exam: string | null;
};
