import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ChevronLeft } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";

export function BackLink<T extends string>({
  href,
  children,
}: {
  href: Route<T>;
  children: React.ReactNode;
}) {
  return (
    <Link
      className="text-muted-foreground hover:text-foreground -mt-4 inline-flex items-center gap-1 px-4 text-sm transition-colors"
      href={href}
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

export function BackLinkSkeleton() {
  return (
    <div className="px-4">
      <Skeleton className="h-5 w-32" />
    </div>
  );
}
