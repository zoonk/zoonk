import { Skeleton } from "@zoonk/ui/components/skeleton";

const EXPLANATION_SKELETON_SECTIONS = ["definition", "change", "importance"];

/**
 * Mirrors the three-part metric explanation layout so loading states reserve
 * roughly the same vertical space as the final content.
 */
export function ProgressExplanationSkeleton() {
  return (
    <div className="flex flex-col gap-5 border-t pt-6">
      {EXPLANATION_SKELETON_SECTIONS.map((section) => (
        <div className="flex flex-col gap-2" key={section}>
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
