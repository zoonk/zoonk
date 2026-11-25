const JPEG_SIGNATURE = Buffer.from("ffd8ff", "hex");
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const RIFF_SIGNATURE = Buffer.from("RIFF");
const WEBP_SIGNATURE = Buffer.from("WEBP");
const RIFF_FORMAT_OFFSET = 8;

export function matchesSourceImageSignature({
  bytes,
  contentType,
}: {
  bytes: Uint8Array;
  contentType: string;
}): boolean {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  switch (contentType) {
    case "image/jpeg":
      return buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);
    case "image/png":
      return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
    case "image/webp":
      return (
        buffer.subarray(0, RIFF_SIGNATURE.length).equals(RIFF_SIGNATURE) &&
        buffer
          .subarray(RIFF_FORMAT_OFFSET, RIFF_FORMAT_OFFSET + WEBP_SIGNATURE.length)
          .equals(WEBP_SIGNATURE)
      );
    default:
      return false;
  }
}
