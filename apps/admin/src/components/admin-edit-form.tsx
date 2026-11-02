import { FieldDynamicDescription, FieldError } from "@zoonk/ui/components/field";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

export function AdminEditForm({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn("flex max-w-2xl flex-col gap-7", className)} {...props} />;
}

export function AdminEditFormActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)} {...props} />
  );
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
    <div className="min-w-0">
      <FieldDynamicDescription key={submissionId} successMessage={successMessage} />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export function AdminEditFormSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex max-w-2xl flex-col gap-7", className)} {...props} />;
}

export function AdminEditFormSkeletonField({
  descriptionClassName,
}: {
  descriptionClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex h-lh items-center text-sm leading-snug">
        <Skeleton className="h-3.5 w-28" />
      </span>
      <Skeleton className="h-11 w-full rounded-lg" />
      <span className={cn("flex h-lh items-start text-sm leading-normal", descriptionClassName)}>
        <Skeleton className="mt-1 h-3.5 w-3/4" />
      </span>
    </div>
  );
}

export function AdminEditFormSkeletonActions() {
  return <Skeleton className="h-9 w-32 rounded-lg" />;
}
