"use client";

import { type CategoryInfo } from "@/lib/categories/category-icons";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

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

export function CategoryPills({ categories }: { categories: CategoryInfo[] }) {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();

  return (
    <HorizontalScroll className="pb-4">
      <HorizontalScrollContent aria-label={t("Course categories")} role="navigation">
        <Link
          className={buttonVariants({
            size: "sm",
            variant: segment === null ? "default" : "outline",
          })}
          href="/courses"
          prefetch
        >
          {t("All")}
        </Link>

        {categories
          .toSorted((a, b) => a.label.localeCompare(b.label))
          .map((category) => (
            <Link
              className={buttonVariants({
                size: "sm",
                variant: segment === category.key ? "default" : "outline",
              })}
              href={`/courses/${category.key}`}
              key={category.key}
              prefetch
            >
              <category.icon aria-hidden className="size-4" />
              {category.label}
            </Link>
          ))}
      </HorizontalScrollContent>
    </HorizontalScroll>
  );
}
