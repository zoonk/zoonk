type PrivateBlobStore = { storeId?: string; token?: string };

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Whether this deployment can reach the private store, where learners' own files live. */
export function isPrivateBlobStoreConfigured(): boolean {
  return Boolean(readEnv("PRIVATE_BLOB_STORE_ID") || readEnv("PRIVATE_BLOB_READ_WRITE_TOKEN"));
}

/**
 * Points a Blob SDK call at the private store, which holds each learner's own files (uploads and
 * private course pictures); calls without it use the public store of shared Library
 * media. On Vercel the SDK signs in with the project's OIDC token and this store's id; where OIDC
 * isn't available (local development, CI), the store's read-write token stands in, and wins when set.
 * Throws when neither is set, so a learner's file never lands in the public store.
 */
export function getPrivateBlobStore(): PrivateBlobStore {
  const storeId = readEnv("PRIVATE_BLOB_STORE_ID");
  const token = readEnv("PRIVATE_BLOB_READ_WRITE_TOKEN");

  if (!storeId && !token) {
    throw new Error(
      "The private Blob store isn't configured: set PRIVATE_BLOB_STORE_ID (Vercel, with OIDC) or PRIVATE_BLOB_READ_WRITE_TOKEN (local development).",
    );
  }

  return { storeId, token };
}
