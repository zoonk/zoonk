import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

/** One centered reading column, the width public course, chapter and lesson pages share. */
export const PUBLIC_COLUMN_CLASS = "mx-auto w-full max-w-[704px] px-5 sm:px-8";

/**
 * A public page: the quiet top bar, the page and the footer. `options` puts a page's "…" menu in
 * the top bar, away from the page's one next step.
 */
export function PublicPage({
  children,
  className,
  options,
}: {
  children: ReactNode;
  className?: string;
  options?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader options={options} />
      <main className={cn("flex-1", className)}>{children}</main>
      <PublicFooter />
    </div>
  );
}

/** Holds the shape of a public page while its content streams in. */
export function PublicPageSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-[72px] sm:px-8">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      <div className={cn(PUBLIC_COLUMN_CLASS, "flex flex-col gap-4 pt-8 sm:pt-12")}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-2 h-5 w-full" />
        <Skeleton className="mt-6 h-72 w-full rounded-3xl" />
      </div>
    </div>
  );
}
