export const FPS = 30;

/** Standard element entry animation duration in frames (400ms). */
export const ENTRY_DURATION = 12;

/** Standard element exit animation duration in frames (~267ms). */
export const EXIT_DURATION = 8;

/**
 * Color palette for the video.
 * White background throughout with accent colors for UI elements.
 */
export const COLORS = {
  black: "#000000",
  white: "#ffffff",
  text: "#0f0f0f",
  muted: "#78716c",
  border: "#e7e5e4",
  success: "#16a34a",
  energy: "#f97316",
  bpGreen: "#22c55e",
  bpBlue: "#3b82f6",
  primary: "#171717",
  primaryFg: "#fafafa",
} as const;

/**
 * Belt colors in order, matching the actual Zoonk belt system.
 * 10 levels from White to Black.
 */
export const BELT_COLORS = [
  { name: "White", hex: "#e8e5e0" },
  { name: "Yellow", hex: "#facc15" },
  { name: "Orange", hex: "#f97316" },
  { name: "Green", hex: "#22c55e" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Brown", hex: "#92400e" },
  { name: "Red", hex: "#ef4444" },
  { name: "Gray", hex: "#6b7280" },
  { name: "Black", hex: "#171717" },
] as const;

/**
 * Scene durations in frames.
 * No crossfades — each scene handles its own entry/exit animations
 * against the shared white background. Hard cuts between scenes.
 *
 * NARRATIVE ARC:
 * ACT 1: THE SPARK — curiosity, understanding
 * ACT 2: THE PROOF — how it works, see for yourself
 * ACT 3: THE FEELING — this respects you, you can do this
 */
export const SCENES = {
  // ACT 1: THE SPARK
  searchPrompt: 4 * FPS,
  everydayLanguage: 3.5 * FPS,
  storyBranch: 6 * FPS,

  // ACT 2: THE PROOF
  visualsHeadline: 3.5 * FPS,
  languageTransform: 5 * FPS,
  visualsMontage: 7 * FPS,

  // ACT 3: THE FEELING
  brainPower: 5 * FPS,
  beltSystem: 5 * FPS,
  energyMeter: 5 * FPS,
  performanceStats: 4 * FPS,
  closingWords: 7 * FPS,
  logo: 4 * FPS,
} as const;
