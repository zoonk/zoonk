/**
 * The four modes the tokens have: the device's light or dark theme, each with or without
 * `prefers-contrast: more`.
 */
export const MODES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "light-more", label: "Light, more contrast" },
  { id: "dark-more", label: "Dark, more contrast" },
] as const;

export type ModeId = (typeof MODES)[number]["id"];

/** The class that draws what's inside it in one mode's tokens, whatever the device's mode is. */
export function modeClass(mode: ModeId): string {
  return `ds-mode-${mode}`;
}
