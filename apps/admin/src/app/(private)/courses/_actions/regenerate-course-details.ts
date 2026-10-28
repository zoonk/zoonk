"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { revalidatePath } from "next/cache";

export type CourseDetailsRewrite = { failed: number; started: number };

export type RegenerateCourseDetailsState = {
  error: string | null;
  rewrite: CourseDetailsRewrite | null;
  submissionId: number;
};

function readRewrite(data: unknown): CourseDetailsRewrite {
  if (typeof data !== "object" || data === null) {
    return { failed: 0, started: 0 };
  }

  return {
    failed: "failed" in data && typeof data.failed === "number" ? data.failed : 0,
    started: "courseIds" in data && Array.isArray(data.courseIds) ? data.courseIds.length : 0,
  };
}

export async function regenerateCourseDetailsAction(
  previousState: RegenerateCourseDetailsState,
): Promise<RegenerateCourseDetailsState> {
  const session = await assertAdmin();
  const submissionId = previousState.submissionId + 1;

  const response = await postAdminApi({
    body: {},
    path: "/v1/library/courses/details/regenerations",
    sessionToken: session.session.token,
  });

  if (!response.ok) {
    return { error: "Could not start the rewrite. Please try again.", rewrite: null, submissionId };
  }

  revalidatePath("/courses");

  const rewrite = readRewrite(response.data);

  if (rewrite.started === 0 && rewrite.failed > 0) {
    return { error: "Could not start the rewrite. Please try again.", rewrite: null, submissionId };
  }

  return { error: null, rewrite, submissionId };
}
