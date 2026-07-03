import { getExtracted } from "next-intl/server";

/**
 * The temporary one-chapter state appears in multiple course surfaces. Keeping
 * the notice in one server component prevents the copy and styling from drifting
 * while background curriculum generation is still filling in the full path.
 */
export async function CourseCurriculumPendingNotice() {
  const t = await getExtracted();

  return (
    <p className="bg-muted/40 text-muted-foreground rounded-lg px-4 py-3 text-sm leading-6">
      {t(
        "The intro chapter is ready. We're still creating the full curriculum, so more chapters will appear here soon.",
      )}
    </p>
  );
}
