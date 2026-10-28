import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";

function readPreview(data: unknown) {
  if (
    typeof data !== "object" ||
    data === null ||
    !("batchSize" in data) ||
    !("estimatedCost" in data) ||
    !("matching" in data) ||
    typeof data.batchSize !== "number" ||
    typeof data.estimatedCost !== "number" ||
    typeof data.matching !== "number"
  ) {
    throw new Error("Invalid course copy rewrite preview");
  }

  return {
    batchSize: data.batchSize,
    estimatedCost: data.estimatedCost,
    matching: data.matching,
    status: "ready" as const,
  };
}

const cachedPreviewCourseDetailsRegeneration = cacheAdminData(async () => {
  const session = await assertAdmin();

  const preview = await getAdminApi({
    path: "/v1/library/courses/details/regenerations",
    sessionToken: session.session.token,
  });

  return readPreview(preview);
});

export async function previewCourseDetailsRegeneration() {
  return cachedPreviewCourseDetailsRegeneration();
}
