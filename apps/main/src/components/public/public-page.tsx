import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { HERO_CLASS } from "./landing-styles";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

export const PUBLIC_COLUMN_CLASS = "mx-auto w-full max-w-[704px] px-5 sm:px-8";

export function PublicPage({
  children,
  className,
  pathname,
}: {
  children: ReactNode;
  className?: string;
  pathname?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className={cn("flex-1", className)}>{children}</main>
      <PublicFooter pathname={pathname} />
    </div>
  );
}

export function PublicPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-dvh flex-col">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-[72px] sm:px-8">
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-11 w-20 rounded-lg lg:h-10" />
      </div>

      <div className={HERO_CLASS}>
        <div className="flex min-w-0 flex-col">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-10 w-full" />
          <Skeleton className="mt-2 h-10 w-2/3" />
          <Skeleton className="mt-6 h-5 w-full max-w-[600px]" />
          <Skeleton className="mt-2 h-5 w-4/5 max-w-[480px]" />
          <Skeleton className="mt-9 h-11 w-full rounded-lg sm:w-48" />
        </div>

        <Skeleton className="h-80 w-full rounded-xl lg:mt-3" />
      </div>
    </div>
  );
}
