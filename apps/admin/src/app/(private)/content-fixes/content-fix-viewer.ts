import "server-only";
import { getStaffPasskeyStatus } from "@zoonk/core/staff/content-fixes/decide";

export type ContentFixViewer = { hasPasskey: boolean; id: string | null };

/** Who reads the page: whether they can approve with a passkey, and which approvals are theirs. */
export async function readContentFixViewer(): Promise<ContentFixViewer> {
  const passkey = await getStaffPasskeyStatus();

  return passkey.status === "ready"
    ? { hasPasskey: passkey.hasPasskey, id: passkey.userId }
    : { hasPasskey: false, id: null };
}
