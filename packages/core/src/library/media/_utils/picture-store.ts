import { logError } from "@zoonk/utils/logger";
import { isPrivateBlobStoreConfigured } from "@zoonk/utils/private-blob-store";

let missingStoreLogged = false;

export function canStorePicture(ownerId: string | null): boolean {
  if (!ownerId || isPrivateBlobStoreConfigured()) {
    return true;
  }

  if (!missingStoreLogged) {
    missingStoreLogged = true;

    logError(
      "Private course pictures are off: the private Blob store isn't configured. Set PRIVATE_BLOB_READ_WRITE_TOKEN (local development) or PRIVATE_BLOB_STORE_ID (Vercel). Their screens show the picture's description instead.",
    );
  }

  return false;
}
