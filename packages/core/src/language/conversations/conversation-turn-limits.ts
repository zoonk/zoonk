/**
 * The most turns a saved call keeps, and the longest turn: the longest exam task stays under both.
 * Kept apart from the contract's schemas, so the call's client trims its transcript without Zod.
 */
export const MAX_CONVERSATION_TURNS = 300;
export const MAX_CONVERSATION_TURN_LENGTH = 2000;
