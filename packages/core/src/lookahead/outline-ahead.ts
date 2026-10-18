/**
 * A skill due within this many days gets its course's chapters outlined, whoever the learner is:
 * the plan reaches it soon, and outlines take a minute or two. Dependency-free, so workflow
 * functions can read it.
 */
export const OUTLINE_AHEAD_DAYS = 14;

/**
 * A stand-in due within this many days (today's) holds time the learner sees on Today now (the day
 * says more lessons are on the way): its course's outline is what they wait on, so it isn't
 * written at the flex tier like the ones a day or more away.
 */
export const OUTLINE_SOON_DAYS = 0;
