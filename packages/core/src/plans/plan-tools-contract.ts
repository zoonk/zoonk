export const TOOL_CHOICES = ["have", "setup", "none"] as const;

/** `phone` means a phone and no computer. */
export const TOOL_SYSTEMS = ["windows", "macos", "linux", "chromebook", "phone"] as const;

export type ToolChoice = (typeof TOOL_CHOICES)[number];
export type ToolSystem = (typeof TOOL_SYSTEMS)[number];
