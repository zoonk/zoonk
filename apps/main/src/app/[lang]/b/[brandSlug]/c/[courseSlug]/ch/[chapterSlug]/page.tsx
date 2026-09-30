import { PublicPageSkeleton } from "@/components/public/public-page";
import {
  type LibraryChapterRoute,
  resolveChapterRoute,
} from "@/data/catalog/resolve-catalog-route";
import { permanentRedirect } from "@/i18n/navigation";
import { getChapterUrls } from "@/lib/public/public-canonical";
import { getContentLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LibraryChapterPage } from "./library-chapter-page";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">;

/**
 * Chapter copy is written in the course's language; only the page in that
 * language is indexed, and a reused chapter's canonical URL is its home course.
 */
async function getLibraryChapterMetadata({
  locale,
  params,
  route,
}: {
  locale: string;
  params: { brandSlug: string; courseSlug: string };
  route: LibraryChapterRoute;
}): Promise<Metadata> {
  const contentLocale = getContentLocale(route.course.language);

  const [t, urls] = await Promise.all([
    getExtracted({ locale: contentLocale ?? locale }),
    getChapterUrls({
      ...params,
      chapterId: route.chapter.id,
      chapterSlug: route.chapter.slug,
      language: route.course.language,
    }),
  ]);

  return {
    alternates: { canonical: urls.canonical },
    description: route.chapter.description,
    robots: { follow: true, index: contentLocale === locale },
    title: t("{chapter}: {course} course", {
      chapter: route.chapter.title,
      course: route.course.title,
    }),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, ...routeParams } = await params;
  const route = await resolveChapterRoute(routeParams);

  if (route.kind !== "library") {
    return {};
  }

  return getLibraryChapterMetadata({ locale: lang, params: routeParams, route });
}

/**
 * A chapter that no longer exists in a course that does moves permanently to
 * the course page. Next.js serves an App Shell for unlisted params first, so
 * the redirect arrives in the stream as an instant meta refresh (which search
 * engines treat as permanent), not as an HTTP status.
 */
async function ChapterRoutePage({ params }: Pick<Props, "params">) {
  const { lang, ...routeParams } = await params;
  const locale = getSupportedLocaleFromLanguage(lang);
  const route = await resolveChapterRoute(routeParams);

  if (route.kind === "notFound") {
    notFound();
  }

  if (route.kind === "redirect") {
    return permanentRedirect({ href: route.href, locale });
  }

  return <LibraryChapterPage params={routeParams} route={route} />;
}

export default function ChapterPage({ params }: Props) {
  return (
    <Suspense fallback={<PublicPageSkeleton />}>
      <ChapterRoutePage params={params} />
    </Suspense>
  );
}
