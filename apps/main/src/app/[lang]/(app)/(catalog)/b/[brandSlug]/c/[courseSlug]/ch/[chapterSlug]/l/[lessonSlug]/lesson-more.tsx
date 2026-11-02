import { ChapterLessonRows } from "@/components/public/chapter-lesson-rows";
import { PublicDisclosure } from "@/components/public/public-disclosure";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref } from "@/lib/public/public-hrefs";
import { getTotalDurationLabel } from "@/lib/public/public-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

type Params = { brandSlug: string; courseSlug: string };

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

  const t = await getExtracted();
  const durationLabel = await getTotalDurationLabel(chapterMinutes);

  return (
    <div className={cn("mt-16 border-y sm:mt-20", ideas.length === 0 && "min-[72rem]:hidden")}>
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
          count: chapter.lessons.length,
          duration: durationLabel,
        })}
        className="min-[72rem]:hidden"
        summary={t("Chapter {number}: {chapter}", {
          chapter: chapter.title,
          number: String(number),
        })}
      >
        <ChapterLessonRows chapter={chapter} currentLessonId={lesson.id} params={params} />

        <Link
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]"
          href={getChapterHref({ ...params, chapterSlug: chapter.slug })}
          prefetch
        >
          {t("Go to the chapter")}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </PublicDisclosure>
    </div>
  );
}
