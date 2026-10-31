import {
  CatalogNotFound,
  getCatalogNotFoundMetadata,
} from "@/components/catalog/catalog-not-found";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { getChapterStaticParams } from "@/data/catalog/catalog-static-params";
import {
  type LibraryChapterRoute,
  resolveChapterRoute,
} from "@/data/catalog/resolve-catalog-route";
import { permanentRedirect } from "@/i18n/navigation";
import { getChapterUrls } from "@/lib/public/public-canonical";
import { getContentLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { LibraryChapterPage } from "./library-chapter-page";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">;

export const ensureStatic = "navigation";

export const instant = false;

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  return getChapterStaticParams(params.lang);
}

/** Only the course's language is indexed, once the catalog lists it; a reused chapter's canonical URL is its home course. */
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

  const t = await getExtracted({ locale: contentLocale ?? locale });

  const urls = await getChapterUrls({
    ...params,
    chapterId: route.chapter.id,
    chapterSlug: route.chapter.slug,
    language: route.course.language,
  });

  return {
    alternates: { canonical: urls.canonical },
    description: route.chapter.description,
    robots: { follow: true, index: route.isListed && contentLocale === locale },
    title: t("{chapter}: {course} course", {
      chapter: route.chapter.title,
      course: route.course.title,
    }),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, ...routeParams } = await params;
  const route = await resolveChapterRoute(routeParams);

  if (route.kind === "notFound") {
    return getCatalogNotFoundMetadata();
  }

  if (route.kind !== "library") {
    return {};
  }

  return getLibraryChapterMetadata({ locale: lang, params: routeParams, route });
}

/** Static and written whole before it's served, so a move is a real permanent redirect. */
export default async function ChapterPage({ params }: Props) {
  const { lang, ...routeParams } = await params;
  const locale = getSupportedLocaleFromLanguage(lang);
  const route = await resolveChapterRoute(routeParams);

  if (route.kind === "notFound") {
    return (
      <NotFoundPage>
        <CatalogNotFound />
      </NotFoundPage>
    );
  }

  if (route.kind === "redirect") {
    return permanentRedirect({ href: route.href, locale });
  }

  return <LibraryChapterPage locale={locale} params={routeParams} route={route} />;
}
