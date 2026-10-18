"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { dismissReviewFlagForAdmin } from "@zoonk/core/library/review-flags/admin";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

export type ReviewFlagActionState = { error: string | null; message: string | null };

/** The flagged lesson or question is still right after the change: it leaves the queue. */
export async function dismissReviewFlagAction(
  _previousState: ReviewFlagActionState,
  formData: FormData,
): Promise<ReviewFlagActionState> {
  await assertAdmin();
  const flagId = parseFormField(formData, "flagId");

  if (!isUuid(flagId)) {
    return { error: "Invalid flag.", message: null };
  }

  const result = await dismissReviewFlagForAdmin(flagId);

  if (result.status !== "ready") {
    return { error: "Could not dismiss this flag.", message: null };
  }

  revalidatePath("/review-flags");
  return { error: null, message: "Dismissed." };
}

/**
 * Starts the rewrite of one flag now, through the API that owns the writing workflows. The API may
 * be down locally, so a failed call returns an error message instead of throwing.
 */
export async function rewriteReviewFlagAction(
  _previousState: ReviewFlagActionState,
  formData: FormData,
): Promise<ReviewFlagActionState> {
  const session = await assertAdmin();
  const flagId = parseFormField(formData, "flagId");

  if (!isUuid(flagId)) {
    return { error: "Invalid flag.", message: null };
  }

  const response = await postAdminApi({
    body: {},
    path: `/v1/library/review-flags/${flagId}/rewrites`,
    sessionToken: session.session.token,
  });

  if (!response.ok) {
    return { error: "Could not start the rewrite. Check that the API is running.", message: null };
  }

  revalidatePath("/review-flags");
  return { error: null, message: "Rewrite started." };
}
