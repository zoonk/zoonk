import "server-only";
import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { IMAGE_STYLE_VERSION } from "@zoonk/ai/tasks/v2/images/style";
import { type MediaAsset, prisma } from "@zoonk/db";
import { assertIdentityKeyScope } from "@zoonk/utils/identity-key";
import { getPrivateImageFolder } from "@zoonk/utils/user-blobs";
import sharp from "sharp";
import { optimizeImage } from "../../../images/optimize-image";
import { uploadImage } from "../../../images/upload-image";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  toLibraryVisibility,
  toProvenanceData,
} from "../../_utils/library-rows";

const IMAGE_MIME_TYPE = "image/webp";

/** Every Library picture sits on a lesson screen; the store adds a random suffix to the name. */
const IMAGE_FILE_NAME = "step.webp";

export type SaveImageAssetInput = {
  image: Uint8Array;
  /** The key identity resolution returned, already scoped to the owner of private content. */
  reuseKey: string;
  /** The scene as one line, for search and the reuse decision. */
  prompt: string;
  scene: ImageScene;
  palette: string;
  /** The labels' language, or null for an image without text. */
  language: string | null;
  ownerId: string | null;
  provenance: LibraryProvenance;
};

/**
 * Shared pictures go to the public Library folder for the CDN; a private course's pictures go to
 * their owner's folder in the private store, so only they can open them and they leave with them.
 */
function getImageUpload(ownerId: string | null) {
  return ownerId
    ? {
        access: "private" as const,
        fileName: `${getPrivateImageFolder(ownerId)}${IMAGE_FILE_NAME}`,
      }
    : { access: "public" as const, fileName: `library/images/${IMAGE_FILE_NAME}` };
}

/** Optimizes and uploads a picture's file: its URL and size, for a new asset or a redrawn one. */
export async function uploadImageFile({
  image,
  ownerId,
}: {
  image: Uint8Array;
  ownerId: string | null;
}) {
  const { data: optimized, error: optimizeError } = await optimizeImage({
    image: Buffer.from(image),
  });

  if (optimizeError) {
    throw optimizeError;
  }

  const [{ height, width }, upload] = await Promise.all([
    sharp(optimized).metadata(),
    uploadImage({ ...getImageUpload(ownerId), image: optimized }),
  ]);

  if (upload.error) {
    throw upload.error;
  }

  return { height, url: upload.data, width };
}

/**
 * Stores a generated image as a Library asset under its reuse key. The file
 * is uploaded only when no asset has the key yet, and a concurrent run that
 * saved the same key first wins, so each scene ends up as one asset.
 */
export async function saveImageAsset(input: SaveImageAssetInput): Promise<MediaAsset> {
  assertIdentityKeyScope({ key: input.reuseKey, ownerId: input.ownerId });

  const { row } = await createOrFindByIdentity({
    create: async () => {
      const file = await uploadImageFile({ image: input.image, ownerId: input.ownerId });

      return prisma.mediaAsset.create({
        data: {
          kind: "image",
          language: input.language,
          mimeType: IMAGE_MIME_TYPE,
          palette: input.palette,
          prompt: input.prompt,
          reuseKey: input.reuseKey,
          scene: input.scene,
          styleVersion: IMAGE_STYLE_VERSION,
          ...file,
          ...toLibraryVisibility(input.ownerId),
          ...toProvenanceData(input.provenance),
        },
      });
    },
    findExisting: () => prisma.mediaAsset.findUnique({ where: { reuseKey: input.reuseKey } }),
  });

  return row;
}
