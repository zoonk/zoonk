/**
 * How a learner will use one of the plan's tools: they have it, they'll set it up (a setup lesson
 * for their device comes before the first chapter that needs it), or they'll learn without it.
 */
export const TOOL_CHOICES = ["have", "setup", "none"] as const;

/** The devices setup lessons are written for; `phone` means a phone and no computer. */
export const TOOL_SYSTEMS = ["windows", "macos", "linux", "chromebook", "phone"] as const;

export type ToolChoice = (typeof TOOL_CHOICES)[number];
export type ToolSystem = (typeof TOOL_SYSTEMS)[number];
