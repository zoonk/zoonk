/**
 * The URL contract with the lesson player (`/learn/[lessonId]`) for a session block: the id of
 * the study session the lesson is a block of, so its answers count toward the session and
 * Hyperdrive carries on from the session's earlier blocks. Without it the lesson plays on its own.
 * Checkpoints and mocks read it too: opened from a session, they continue back to it.
 */
export const STUDY_SESSION_PARAM = "session";
