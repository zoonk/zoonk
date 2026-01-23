export const AI_ORG_SLUG = "ai";
export const SUPPORT_URL = "https://www.zoonk.com/help";

export const BYTES_PER_MB = 1024 * 1024;
export const DEFAULT_IMAGE_MAX_SIZE = 5 * BYTES_PER_MB;

export const DEFAULT_IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const DEFAULT_SEARCH_LIMIT = 10;

export const TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "fable",
  "marin",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

export type TTSVoice = (typeof TTS_VOICES)[number];
