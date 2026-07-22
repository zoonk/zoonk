import { FieldDynamicDescription, FieldError } from "@zoonk/ui/components/field";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * Admin edit pages share one restrained form width and rhythm so adding another
 * record editor does not introduce a slightly different layout.
 */
export function AdminEditForm({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn("flex max-w-2xl flex-col gap-7", className)} {...props} />;
}

/**
 * Secondary navigation and the primary save action stay grouped at the end of
 * every admin edit form in the same visual order.
 */
export function AdminEditFormActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2", className)} {...props} />;
}

/**
 * Save feedback always reserves one line so a confirmation or validation error
 * does not move the form actions when it appears.
 */
export function AdminEditFormFeedback({
  error,
  submissionId,
  successMessage,
}: {
  error: string | null;
  submissionId: number;
  successMessage: string | null;
}) {
  return (
    <div className="min-h-5">
      <FieldDynamicDescription key={submissionId} successMessage={successMessage} />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

/**
 * The edit-page fallback reserves the same narrow column as the loaded form so
 * dynamic record reads do not shift the surrounding admin layout.
 */
export function AdminEditFormSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex max-w-2xl flex-col gap-7", className)} {...props} />;
}

/**
 * A label and control placeholder mirror one standard admin form field while
 * its private default value is loading.
 */
export function AdminEditFormSkeletonField() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/**
 * Action placeholders preserve the final row without suggesting that loading
 * controls can already be submitted.
 */
export function AdminEditFormSkeletonActions() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-9 w-20 rounded-full" />
      <Skeleton className="h-9 w-32 rounded-full" />
    </div>
  );
}
