export const MODES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "light-more", label: "Light, more contrast" },
  { id: "dark-more", label: "Dark, more contrast" },
] as const;

export type ModeId = (typeof MODES)[number]["id"];

export function modeClass(mode: ModeId): string {
  return `ds-mode-${mode}`;
}
