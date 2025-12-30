"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ScrollArea, ScrollBar } from "@zoonk/ui/components/scroll-area";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useSelectedLayoutSegment } from "next/navigation";
import { useExtracted } from "next-intl";
import { useCategories } from "@/hooks/use-categories";
import { Link } from "@/i18n/navigation";

export function CategoryPillsSkeleton() {
  return (
    <div className="mx-auto w-full lg:max-w-xl">
      <div className="flex gap-2 px-4 pt-4 pb-2 lg:pt-0">
        <Skeleton className="h-8 w-12 rounded-4xl" />
        <Skeleton className="h-8 w-16 rounded-4xl" />
        <Skeleton className="h-8 w-24 rounded-4xl" />
        <Skeleton className="h-8 w-20 rounded-4xl" />
        <Skeleton className="h-8 w-20 rounded-4xl" />
        <Skeleton className="h-8 w-16 rounded-4xl" />
      </div>
    </div>
  );
}

export function CategoryPills() {
  const segment = useSelectedLayoutSegment();
  const categories = useCategories();
  const t = useExtracted();

  return (
    <ScrollArea className="w-full px-4 pb-4">
      <nav aria-label={t("Course categories")} className="flex gap-2">
        <Link
          className={buttonVariants({
            size: "sm",
            variant: segment === null ? "default" : "outline",
          })}
          href="/courses"
        >
          {t("All")}
        </Link>

        {categories
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((category) => (
            <Link
              className={buttonVariants({
                size: "sm",
                variant: segment === category.key ? "default" : "outline",
              })}
              href={`/courses/${category.key}`}
              key={category.key}
            >
              <category.icon aria-hidden className="size-4" />
              {category.label}
            </Link>
          ))}
      </nav>

      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
