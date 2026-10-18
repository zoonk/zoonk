import { logError } from "@zoonk/utils/logger";
import { isPrivateBlobStoreConfigured } from "@zoonk/utils/private-blob-store";

/** The missing store is logged once per process, not once for every picture it holds back. */
let missingStoreLogged = false;

/**
 * Whether a picture drawn for `ownerId` can be stored: a shared picture goes to the public store,
 * and a private course's to the private store, which a local setup may lack. Without that store
 * nothing is planned or drawn, since no retry can upload it: no AI is spent on a picture that
 * can't be kept, and the first one held back says why in the logs.
 */
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
