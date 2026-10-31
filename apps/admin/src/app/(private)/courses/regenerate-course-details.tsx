import { previewCourseDetailsRegeneration } from "@/data/courses/preview-course-details-regeneration";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { RegenerateCourseDetailsForm } from "./regenerate-course-details-form";

export async function RegenerateCourseDetails() {
  "use cache: private";

  const preview = await previewCourseDetailsRegeneration();

  if (preview.status !== "ready") {
    return null;
  }

  return (
    <RegenerateCourseDetailsForm
      batchSize={preview.batchSize}
      estimatedCost={preview.estimatedCost}
      matching={preview.matching}
    />
  );
}

export function RegenerateCourseDetailsSkeleton() {
  return (
    <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <Skeleton className="h-5 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-7.5 w-48" />
    </div>
  );
}
