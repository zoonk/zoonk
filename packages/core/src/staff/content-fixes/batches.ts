import { ADMIN_URL } from "@zoonk/utils/url";

/** An approver can still read every fix of a batch on one page and approve them with one passkey. */
export const MAX_BATCH_FIXES = 250;

/** A fix proposed before batches existed is its own batch of one. */
export function batchOf(fix: { batchId: string | null; id: string }): string {
  return fix.batchId ?? fix.id;
}

export function batchWhere(batchId: string) {
  return { OR: [{ batchId }, { batchId: null, id: batchId }] };
}

export function getContentFixReviewUrl(fixId: string): string {
  return new URL(`/content-fixes/${fixId}`, ADMIN_URL).toString();
}

export function getContentFixBatchReviewUrl(batchId: string): string {
  return new URL(`/content-fixes/batches/${batchId}`, ADMIN_URL).toString();
}
