export const FPS = 30;

/** Duration of the video in seconds. */
export const DURATION = 60;

/** Crossfade duration between scenes in frames (~0.27s). */
export const TRANSITION_FRAMES = 8;

/** Longer crossfade at act boundaries in frames (~0.4s). */
export const ACT_TRANSITION_FRAMES = 12;

/** Standard element entry animation duration in frames (400ms). */
export const ENTRY_DURATION = 12;

/** Standard element exit animation duration in frames (~267ms). */
export const EXIT_DURATION = 8;

/**
 * Color palette for the video.
 * Alternating black/white backgrounds with accent colors for UI elements.
 */
export const COLORS = {
  black: "#000000",
  white: "#ffffff",
  text: "#0f0f0f",
  textOnBlack: "#ffffff",
  muted: "#78716c",
  mutedOnBlack: "rgba(255, 255, 255, 0.4)",
  border: "#e7e5e4",
  borderOnBlack: "rgba(255, 255, 255, 0.12)",
  success: "#16a34a",
  successBg: "rgba(22, 163, 74, 0.08)",
  energy: "#f97316",
  bpGreen: "#22c55e",
  bpBlue: "#3b82f6",
  primary: "#171717",
  primaryFg: "#fafafa",
  desaturated: "#1a1a1a",
} as const;

/**
 * Scene durations in frames.
 * These are the "content" durations for each TransitionSeries.Sequence.
 * Transition overlaps are handled by TransitionSeries automatically.
 */
export const SCENES = {
  // ACT 1: THE SPARK (0:00-0:12)
  searchPrompt: 5.5 * FPS,
  typographyMoment1: 1 * FPS,
  statusQuo: 1.5 * FPS,
  zoonkCard: 2 * FPS,

  // ACT 2: THE PROOF (0:12-0:38)
  timeline: 5 * FPS,
  fillInBlank: 5 * FPS,
  nodeDiagram: 5 * FPS,
  storyBranch: 5 * FPS,
  typographyMoment2: 6 * FPS,

  // ACT 3: THE FEELING (0:38-1:00)
  brainPowerBelt: 3 * FPS,
  energyMeter: 3 * FPS,
  performanceStats: 3 * FPS,
  multiLanguageFlash: 3 * FPS,
  theBreath: 2 * FPS,
  closingWords: 6 * FPS,
  logo: 2 * FPS,
} as const;
