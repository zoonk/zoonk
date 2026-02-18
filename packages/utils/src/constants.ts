export const AI_ORG_SLUG = "ai";

function getDefaultApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:4000";
  }

  if (process.env.VERCEL_ENV !== "production") {
    return "https://api.zoonk.dev";
  }

  return "https://api.zoonk.com";
}

export const API_URL = getDefaultApiUrl();
export const SUPPORT_URL = "https://www.zoonk.com/help";

export const BYTES_PER_MB = 1024 * 1024;
export const DEFAULT_IMAGE_MAX_SIZE_MB = 5;
export const DEFAULT_IMAGE_MAX_SIZE = DEFAULT_IMAGE_MAX_SIZE_MB * BYTES_PER_MB;
export const DEFAULT_IMAGE_QUALITY = 80;

export const DEFAULT_PROGRESS_LOOKBACK_DAYS = 90;

export const EMAIL_SUBJECT_MAX_LENGTH = 50;
export const SLUG_MAX_LENGTH = 50;

export const EPOCH_YEAR = 1970;
export const FIRST_SUNDAY_OFFSET = 4;

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

export const BRAIN_POWER_PER_ACTIVITY = 10;
export const BRAIN_POWER_PER_CHALLENGE = 100;
export const CHALLENGE_FAILURE_ENERGY = 0.1;
export const DAILY_DECAY = 1;
export const ENERGY_PER_CORRECT = 0.2;
export const ENERGY_PER_INCORRECT = -0.1;
export const ENERGY_PER_STATIC = 0.1;
export const MAX_ENERGY = 100;
export const MIN_ENERGY = 0;

export const STORAGE_KEY_DISPLAY_NAME = "zoonk:displayName";
export const NAME_PLACEHOLDER = "{{NAME}}";
