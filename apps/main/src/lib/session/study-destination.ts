/** `changed` opens nothing: the screen reads itself again so the learner sees the change first. */
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
