/**
 * How many experiments the learner runs during an investigation
 * activity before advancing to the call step. Used by:
 * - The content schema to enforce a minimum action count
 * - The player to control the investigation loop
 */
export const INVESTIGATION_EXPERIMENT_COUNT = 2;

/**
 * Fixed story ending tiers. The AI writes one ending per tier, while the
 * player owns the scoring logic that decides which tier the learner sees.
 */
export const STORY_OUTCOME_TIERS = ["perfect", "good", "ok", "bad", "terrible"] as const;

export type StoryOutcomeTier = (typeof STORY_OUTCOME_TIERS)[number];
