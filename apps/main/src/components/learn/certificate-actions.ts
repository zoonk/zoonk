"use server";

import { claimCourseCertificate } from "@zoonk/core/certificates/claim";
import { type OwnedCertificateFacts } from "@zoonk/core/certificates/contract";
import { markCertificateShown } from "@zoonk/core/certificates/mark-shown";
import { updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export async function markCertificateShownAction(code: string): Promise<void> {
  await markCertificateShown(code);
}

/** Writes a finished course's certificate, or reads it when it's written; null when it can't. */
export async function claimCourseCertificateAction(
  goalId: string,
): Promise<OwnedCertificateFacts | null> {
  const result = await claimCourseCertificate(goalId);
  return result.status === "ready" ? result.certificate : null;
}

/** The profile name is the one every certificate shows, so this renames them all. */
export async function saveCertificateNameAction(name: string): Promise<boolean> {
  const trimmed = name.trim();

  if (!trimmed) {
    return false;
  }

  const { data, error } = await safeAsync(() => updateCurrentUser({ input: { name: trimmed } }));

  if (error) {
    logError("Error saving the name on certificates:", error);
  }

  return Boolean(data);
}
