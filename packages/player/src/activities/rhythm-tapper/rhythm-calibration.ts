/** Clicks counted in before measuring, so the learner has the pulse before tapping along. */
export const CALIBRATION_COUNT_IN = 3;

/** Clicks the learner taps along with; the delay is the middle of their taps' distances. */
export const CALIBRATION_CLICKS = 6;

/**
 * 60 bpm: a tap half a second late still sits nearer its own click than the next one, so delays
 * up to the most Bluetooth headphones add are read right.
 */
export const CALIBRATION_INTERVAL_MS = 1000;
