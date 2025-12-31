"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

const DESCRIPTION_TRUNCATE_THRESHOLD = 100;

export function CourseHeader({
  children,
  className,
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "mx-auto flex w-full max-w-xl flex-row items-start gap-4 px-4",
        className,
      )}
      data-slot="course-header"
    >
      {children}
    </header>
  );
}

export function CourseHeaderImage({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative size-24 shrink-0 overflow-hidden rounded-xl md:size-32",
        className,
      )}
      data-slot="course-header-image"
    >
      {children}
    </div>
  );
}

export function CourseHeaderIcon({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex size-24 shrink-0 items-center justify-center rounded-xl bg-muted/70 md:size-32",
        className,
      )}
      data-slot="course-header-icon"
    >
      {children}
    </div>
  );
}

export function CourseHeaderContent({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      data-slot="course-header-content"
    >
      {children}
    </div>
  );
}

export function CourseHeaderSource({
  children,
  className,
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground/70 text-xs", className)}
      data-slot="course-header-source"
    >
      {children}
    </span>
  );
}

export function CourseHeaderTitle({
  children,
  className,
}: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-balance font-semibold text-foreground/90 text-lg leading-tight tracking-tight md:text-xl",
        className,
      )}
      data-slot="course-header-title"
    >
      {children}
    </h1>
  );
}

export function CourseHeaderDescription({
  className,
  children,
}: {
  className?: string;
  children: string;
}) {
  const shouldTruncate = children.length > DESCRIPTION_TRUNCATE_THRESHOLD;

  if (!shouldTruncate) {
    return (
      <p
        className={cn(
          "mt-1 text-pretty text-muted-foreground text-sm leading-relaxed",
          className,
        )}
        data-slot="course-header-description"
      >
        {children}
      </p>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "mt-1 line-clamp-2 cursor-pointer text-pretty text-left text-muted-foreground text-sm leading-relaxed",
          className,
        )}
        data-slot="course-header-description"
        nativeButton={false}
        render={<p />}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="max-h-64 w-80 overflow-y-auto">
        <p className="text-pretty text-sm leading-relaxed">{children}</p>
      </PopoverContent>
    </Popover>
  );
}

export function CourseHeaderMeta({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-1.5 text-xs",
        className,
      )}
      data-slot="course-header-meta"
    >
      {children}
    </div>
  );
}

export function CourseHeaderSkeleton({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "mx-auto flex w-full max-w-xl flex-row items-start gap-4 px-4",
        className,
      )}
      data-slot="course-header"
    >
      <Skeleton className="size-24 rounded-xl md:size-32" />
      <div className="flex flex-1 flex-col">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-1 h-6 w-3/4" />
        <Skeleton className="mt-1 h-10 w-full" />
        <Skeleton className="mt-2 h-5 w-24" />
      </div>
    </header>
  );
}
