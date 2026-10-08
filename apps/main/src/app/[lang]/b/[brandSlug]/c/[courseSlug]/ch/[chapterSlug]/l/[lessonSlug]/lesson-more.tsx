import { LibraryLessonRows } from "@/components/public/library-lesson-rows";
import { PublicDisclosure } from "@/components/public/public-disclosure";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref, getLessonHref } from "@/lib/public/public-hrefs";
import { getTotalDurationLabel } from "@/lib/public/public-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

type Params = { brandSlug: string; courseSlug: string };

/**
 * Everything past the first question waits one tap away, still in the HTML: what the lesson
 * teaches (its summary, one idea a line) and the rest of its chapter.
 */
export async function LessonMore({
  ideas,
  params,
  route,
}: {
  ideas: string[];
  params: Params;
  route: LibraryLessonRoute;
}) {
  const { chapter, lesson, number } = route;
  const chapterMinutes = chapter.lessons.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const [t, durationLabel] = await Promise.all([
    getExtracted(),
    getTotalDurationLabel(chapterMinutes),
  ]);

  const lessons = chapter.lessons.map((item) => ({
    href: getLessonHref({ ...params, chapterSlug: chapter.slug, lessonSlug: item.slug }),
    id: item.id,
    minutes: item.estimatedMinutes,
    title: item.title,
  }));

  return (
    <div className="mt-16 sm:mt-20">
      {ideas.length > 0 && (
        <PublicDisclosure
          aside={t("{count, plural, one {# idea} other {# ideas}}", { count: ideas.length })}
          summary={t("What you'll learn")}
        >
          <ul className="flex flex-col gap-3">
            {ideas.map((idea) => (
              <li className="flex gap-3 text-[15px] leading-relaxed sm:text-base" key={idea}>
                <LineMarker>
                  <span aria-hidden="true" className="bg-foreground/35 size-1.5 rounded-full" />
                </LineMarker>
                <span className="text-pretty">{idea}</span>
              </li>
            ))}
          </ul>
        </PublicDisclosure>
      )}

      <PublicDisclosure
        aside={t("{count, plural, one {# lesson} other {# lessons}} · {duration}", {
          count: lessons.length,
          duration: durationLabel,
        })}
        summary={t("Chapter {number}: {chapter}", {
          chapter: chapter.title,
          number: String(number),
        })}
      >
        <LibraryLessonRows currentLessonId={lesson.id} lessons={lessons} />

        <Link
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]"
          href={getChapterHref({ ...params, chapterSlug: chapter.slug })}
        >
          {t("Go to the chapter")}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </PublicDisclosure>
    </div>
  );
}
