/** What generated API clients send for a binary part when the contract names no media type. */
const GENERIC_MEDIA_TYPES = new Set(["", "application/octet-stream"]);

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const encoder = new TextEncoder();
const ascii = (text: string) => [...encoder.encode(text)];

/** Where an MP4's `ftyp` box name and a WAV's `WAVE` form type start. */
const MP4_BOX_TYPE_OFFSET = 4;
const WAV_FORM_TYPE_OFFSET = 8;

const EBML_HEADER = [...Buffer.from("1a45dfa3", "hex")];

/** An MPEG audio frame starts with eleven set bits: FF, then a byte of at least E0. */
const FRAME_SYNC_BYTE = 255;
const FRAME_SYNC_SECOND_BYTE_MIN = 224;

export function resolveAudioMediaType({
  bytes,
  declared,
}: {
  bytes: Uint8Array;
  declared: string;
}): string {
  if (!GENERIC_MEDIA_TYPES.has(declared.trim().toLowerCase())) {
    return declared;
  }

  if (startsWith(bytes, ascii("ftyp"), MP4_BOX_TYPE_OFFSET)) {
    return "audio/mp4";
  }

  if (startsWith(bytes, EBML_HEADER)) {
    return "audio/webm";
  }

  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WAVE"), WAV_FORM_TYPE_OFFSET)) {
    return "audio/wav";
  }

  const isFrameSync = bytes[0] === FRAME_SYNC_BYTE && (bytes[1] ?? 0) >= FRAME_SYNC_SECOND_BYTE_MIN;

  if (startsWith(bytes, ascii("ID3")) || isFrameSync) {
    return "audio/mpeg";
  }

  return declared;
}
