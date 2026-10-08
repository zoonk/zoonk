/**
 * Where a block of today's session is played: a lesson in the lesson player, a checkpoint, a
 * mock exam or an essay on its own screen, and every other block (or the summary) on the session screen.
 * Lessons, checkpoints and mocks open with the session they're a block of, so they lead back to it.
 * A lesson that isn't written yet (`unwrittenLesson`) is asked for from the learner's browser
 * first, then the session screen shows its wait, or why it can't be written now.
 */
export type StudyDestination =
  | { blockId: string; kind: "checkpoint" | "mock"; sessionId: string }
  | { blockId: string; kind: "essay" }
  | { kind: "lesson"; lessonId: string; sessionId: string }
  | { kind: "session" }
  | { kind: "unwrittenLesson"; lessonId: string }
  | { kind: "today" };
