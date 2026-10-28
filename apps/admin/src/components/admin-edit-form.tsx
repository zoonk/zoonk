import { FieldDynamicDescription, FieldError } from "@zoonk/ui/components/field";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

export function AdminEditForm({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn("flex max-w-2xl flex-col gap-7", className)} {...props} />;
}

export function AdminEditFormActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2", className)} {...props} />;
}

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

export function AdminEditFormSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex max-w-2xl flex-col gap-7", className)} {...props} />;
}

export function AdminEditFormSkeletonField() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function AdminEditFormSkeletonActions() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-9 w-20 rounded-full" />
      <Skeleton className="h-9 w-32 rounded-full" />
    </div>
  );
}
