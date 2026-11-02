function readStoreId(): string | undefined {
  return process.env.PRIVATE_BLOB_STORE_ID?.trim() || undefined;
}

export function isPrivateBlobStoreConfigured(): boolean {
  return Boolean(readStoreId());
}

/**
 * Vercel sets `PRIVATE_BLOB_STORE_ID` when the private store is connected with the `PRIVATE_BLOB`
 * prefix, and the SDK signs in to it with the project's OIDC token. Throws when it isn't set, so a
 * learner's file never lands in the public store.
 */
export function getPrivateBlobStore(): { storeId: string } {
  const storeId = readStoreId();

  if (!storeId) {
    throw new Error("The private Blob store isn't configured: set PRIVATE_BLOB_STORE_ID.");
  }

  return { storeId };
}
