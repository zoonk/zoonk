export const FPS = 30;

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
