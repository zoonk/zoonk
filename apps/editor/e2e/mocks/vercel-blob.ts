import { randomUUID } from "node:crypto";

/**
 * Mock implementation of @vercel/blob for E2E testing.
 * Returns fake URLs without making actual blob storage requests.
 */
export async function put(
  pathname: string,
  _body: BodyInit,
  options?: { access?: string; addRandomSuffix?: boolean },
) {
  const suffix =
    options?.addRandomSuffix !== false ? `-${randomUUID().slice(0, 8)}` : "";
  const url = `https://e2e-mock-blob.test/${pathname}${suffix}`;

  return {
    downloadUrl: url,
    pathname: `${pathname}${suffix}`,
    url,
  };
}

export async function del() {
  // No-op for E2E testing
}

export async function list() {
  return { blobs: [] };
}
