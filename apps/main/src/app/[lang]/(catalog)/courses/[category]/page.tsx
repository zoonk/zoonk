import { CatalogGridSkeleton } from "@/components/catalog/catalog-skeletons";
import { LIST_COURSES_LIMIT, listCourses } from "@/data/courses/list-courses";
import { getCategoryHeader, getCategoryLabel, getCategoryMeta } from "@/lib/categories/category";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { COURSE_CATEGORIES, isValidCategory } from "@zoonk/utils/categories";
import { type Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseListClient } from "../course-list-client";

type CategoryParamsProps = Pick<PageProps<"/[lang]/courses/[category]">, "params">;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses/[category]">): Promise<Metadata> {
  const { category, lang } = await params;

  if (!isValidCategory(category)) {
    return {};
  }

  return {
    ...(await getCategoryMeta({ category })),
    alternates: { canonical: getLocalizedUrl({ href: `/courses/${category}`, language: lang }) },
    robots: { follow: true, index: true },
  };
}

/**
 * Resolves the category inside the grid boundary so the surrounding catalog
 * frame can prerender without binding its shell to one request URL.
 */
async function CategoryCourseListContent({ params }: CategoryParamsProps) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const locale = await getLocale();
  const courses = await listCourses({ category, language: locale });
  const categoryLabel = await getCategoryLabel(category);

  return (
    <CourseListClient
      category={{ key: category, label: categoryLabel }}
      initialCourses={courses}
      language={locale}
      limit={LIST_COURSES_LIMIT}
    />
  );
}

/**
 * Resolves translated category copy independently from the course query so both
 * sections can stream as soon as their own work finishes.
 */
async function CategoryHeader({ params }: CategoryParamsProps) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const header = await getCategoryHeader(category);

  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <ContainerTitle>{header.title}</ContainerTitle>
        <ContainerDescription>{header.description}</ContainerDescription>
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}

/** Pre-renders every category from the shared fixed taxonomy. */
export function generateStaticParams() {
  return COURSE_CATEGORIES.map((category) => ({ category }));
}

export default function CategoryCourses(props: PageProps<"/[lang]/courses/[category]">) {
  return (
    <Container variant="grid">
      <Suspense
        fallback={
          <ContainerHeader>
            <ContainerHeaderGroup>
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </ContainerHeaderGroup>
          </ContainerHeader>
        }
      >
        <CategoryHeader params={props.params} />
      </Suspense>

      <Suspense fallback={<CatalogGridSkeleton count={8} />}>
        <CategoryCourseListContent params={props.params} />
      </Suspense>
    </Container>
  );
}
