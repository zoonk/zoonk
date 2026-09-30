import {
  RouteCard,
  RouteCardDivider,
  RouteCardEyebrow,
  RouteCardFact,
  RouteCardFacts,
  RouteCardTitle,
  RouteStop,
  RouteStops,
} from "@/components/public/route-card";
import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getLessonHref } from "@/lib/public/public-hrefs";
import { getLevelLabel, getMinutesLabel, getTotalDurationLabel } from "@/lib/public/public-labels";
import { ClockIcon, LayersIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

type Params = { brandSlug: string; courseSlug: string };

/**
 * The chapter's lessons as a route, like the home page's plan: where it starts and each lesson
 * after it, one tap each, with how long it takes.
 */
export async function ChapterLessonsCard({
  params,
  route,
}: {
  params: Params;
  route: LibraryChapterRoute;
}) {
  const { chapter, number, total } = route;
  const minutes = chapter.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0);

  const [t, durationLabel, levelLabel, minuteLabels] = await Promise.all([
    getExtracted(),
    getTotalDurationLabel(minutes),
    getLevelLabel(chapter.level),
    Promise.all(chapter.lessons.map((lesson) => getMinutesLabel(lesson.estimatedMinutes))),
  ]);

  return (
    <RouteCard className="lg:mt-3" label={t("Lessons")}>
      <RouteCardEyebrow>
        {t("Chapter {number} of {total}", { number: String(number), total: String(total) })}
      </RouteCardEyebrow>
      <RouteCardTitle>
        {t("{count, plural, one {# short lesson} other {# short lessons}}", {
          count: chapter.lessons.length,
        })}
      </RouteCardTitle>

      <RouteCardFacts>
        <RouteCardFact icon={<ClockIcon aria-hidden="true" />}>{durationLabel}</RouteCardFact>
        <RouteCardFact icon={<LayersIcon aria-hidden="true" />}>{levelLabel}</RouteCardFact>
      </RouteCardFacts>

      <RouteCardDivider />

      <RouteStops>
        {chapter.lessons.map((lesson, index) => (
          <RouteStop
            aside={minuteLabels[index]}
            key={lesson.id}
            state={index === 0 ? "now" : "future"}
            title={
              <Link
                className="focus-visible:ring-ring/50 -my-3 inline-block rounded-md py-3 outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]"
                href={getLessonHref({
                  ...params,
                  chapterSlug: chapter.slug,
                  lessonSlug: lesson.slug,
                })}
              >
                {lesson.title}
              </Link>
            }
          />
        ))}
      </RouteStops>
    </RouteCard>
  );
}
