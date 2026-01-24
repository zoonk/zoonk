const IMPORT_MODES = ["merge", "replace"] as const;

export type ImportMode = (typeof IMPORT_MODES)[number];

export function isImportMode(value: unknown): value is ImportMode {
  return typeof value === "string" && IMPORT_MODES.some((mode) => mode === value);
}
