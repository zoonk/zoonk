/**
 * Where a block of today's session is played: a lesson in the lesson player, a checkpoint, a
 * mock exam or an essay on its own screen, and every other block (or the summary) on the session screen.
 * A planned challenge (a checkpoint or a mock) that hasn't started opens on its intro (`challenge`),
 * which starts it. Lessons, challenges, checkpoints and mocks open with the session they're a block
 * of, so they lead back to it. A lesson that isn't written yet (`unwrittenLesson`) is asked for from
 * the learner's browser first, then the session screen shows its wait, or why it can't be written now;
 * one written by then opens in the player. A step whose lesson the plan hasn't picked yet (a chapter
 * with none written: `preparingLesson`) is prepared by the tap, and the session screen waits for it.
 * The session screen opens on the block the learner opened (`blockId`), whichever of the day's
 * blocks it is. A step that changed since the screen showed it (`changed`: another mock than the
 * one shown is next now) opens nothing: the screen reads itself again so the learner sees it first.
 */
export type StudyDestination =
  | { blockId: string; kind: "checkpoint" | "mock"; sessionId: string }
  | { kind: "challenge"; planItemId: string; sessionId: string }
  | { kind: "changed" }
  | { blockId: string; kind: "essay" }
  | { kind: "lesson"; lessonId: string; sessionId: string }
  | { blockId: string; kind: "preparingLesson" }
  | { blockId?: string; kind: "session" }
  | { blockId: string; kind: "unwrittenLesson"; lessonId: string; sessionId: string }
  | { kind: "today" };
