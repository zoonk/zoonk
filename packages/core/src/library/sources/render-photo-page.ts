import "server-only";
import { optimizeImage } from "../../images/optimize-image";
import { MAX_PAGE_EDGE } from "./render-pdf-page";
import { matchesSourceImageSignature } from "./source-image-signature";

const MAX_PHOTO_PIXELS = 64_000_000;

/** The page image a photo is read from: upright, at most `MAX_PAGE_EDGE` on its long side, as JPEG. */
export async function renderPhotoPage(photo: { bytes: Uint8Array; contentType: string }) {
  if (!matchesSourceImageSignature(photo)) {
    throw new Error("The uploaded photo does not match its file type");
  }

  const { data, error } = await optimizeImage({
    format: "jpeg",
    image: photo.bytes,
    limitInputPixels: MAX_PHOTO_PIXELS,
    maxEdge: MAX_PAGE_EDGE,
  });

  if (error) {
    throw error;
  }

  return { data, mediaType: "image/jpeg" };
}
