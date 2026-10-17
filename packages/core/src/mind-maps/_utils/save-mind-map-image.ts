import "server-only";
import { getPrivateImageFolder } from "@zoonk/utils/user-blobs";
import sharp from "sharp";
import { optimizeImage } from "../../images/optimize-image";
import { uploadImage } from "../../images/upload-image";

/** Lists of maps show this copy, about a fifth of the full picture's size. */
const THUMBNAIL_WIDTH = 640;

export type SavedMindMapImage = {
  height: number;
  thumbnailUrl: string;
  url: string;
  width: number;
};

/**
 * A shared chapter's map goes to the public Library folder for the CDN; a private chapter's goes to
 * its owner's folder in the private store, so only they can open it and it leaves with them.
 */
function getUploadTarget({ name, ownerId }: { name: string; ownerId: string | null }) {
  return ownerId
    ? { access: "private" as const, fileName: `${getPrivateImageFolder(ownerId)}${name}` }
    : { access: "public" as const, fileName: `library/mind-maps/${name}` };
}

async function upload({
  image,
  name,
  ownerId,
}: {
  image: Buffer;
  name: string;
  ownerId: string | null;
}): Promise<string> {
  const { data, error } = await uploadImage({ ...getUploadTarget({ name, ownerId }), image });

  if (error) {
    throw error;
  }

  return data;
}

/** Stores a map's picture as webp with a small copy for lists, and returns where both are. */
export async function saveMindMapImage({
  image,
  ownerId,
}: {
  image: Uint8Array;
  ownerId: string | null;
}): Promise<SavedMindMapImage> {
  const { data: optimized, error } = await optimizeImage({ image: Buffer.from(image) });

  if (error) {
    throw error;
  }

  const [thumbnail, { height, width }] = await Promise.all([
    sharp(optimized).resize({ width: THUMBNAIL_WIDTH }).webp().toBuffer(),
    sharp(optimized).metadata(),
  ]);

  const [url, thumbnailUrl] = await Promise.all([
    upload({ image: optimized, name: "mind-map.webp", ownerId }),
    upload({ image: thumbnail, name: "mind-map-thumb.webp", ownerId }),
  ]);

  return { height, thumbnailUrl, url, width };
}
