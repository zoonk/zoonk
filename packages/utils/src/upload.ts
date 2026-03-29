export const BYTES_PER_MB = 1024 * 1024;

const DEFAULT_IMAGE_MAX_SIZE_MB = 5;
export const DEFAULT_IMAGE_MAX_SIZE = DEFAULT_IMAGE_MAX_SIZE_MB * BYTES_PER_MB;
export const DEFAULT_IMAGE_QUALITY = 80;
export const DEFAULT_IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const DEFAULT_AUDIO_MAX_SIZE_MB = 10;
export const DEFAULT_AUDIO_MAX_SIZE = DEFAULT_AUDIO_MAX_SIZE_MB * BYTES_PER_MB;
export const DEFAULT_AUDIO_ACCEPTED_TYPES = ["audio/wav", "audio/ogg", "audio/mpeg", "audio/opus"];
