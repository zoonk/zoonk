import { ADMIN_URL } from "@zoonk/utils/url";

/** An approver can still read every fix of a batch on one page and approve them with one passkey. */
export const MAX_BATCH_FIXES = 250;

export function getContentFixReviewUrl(fixId: string): string {
  return new URL(`/content-fixes/${fixId}`, ADMIN_URL).toString();
}

export function getContentFixBatchReviewUrl(batchId: string): string {
  return new URL(`/content-fixes/batches/${batchId}`, ADMIN_URL).toString();
}
