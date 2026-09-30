import {
  RouteCard,
  RouteCardDivider,
  RouteCardEyebrow,
  RouteCardFact,
  RouteCardFacts,
  RouteCardTitle,
  RouteStop,
  type RouteStopState,
  RouteStops,
} from "@/components/public/route-card";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import { getLevelLabel, getTotalDurationLabel } from "@/lib/public/public-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ClockIcon, LayersIcon, SkipForwardIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** How many chapter names a level's stop mentions, and how many chapters a one-level course lists. */
const CHAPTERS_NAMED = 3;
const CHAPTERS_LISTED = 5;

/** A no-break space keeps each dot at the end of a line, never at the start of the next. */
const CHAPTER_SEPARATOR = "\u00A0· ";

/** The first stop is where everyone starts, the last one is where the course ends. */
function getStopState(index: number, count: number): RouteStopState {
  if (index === 0) {
    return "now";
  }

  return index === count - 1 ? "goal" : "future";
}

async function LevelStops({ outline }: { outline: LibraryOutline }) {
  const [t, levelLabels] = await Promise.all([
    getExtracted(),
    Promise.all(outline.levels.map((band) => getLevelLabel(band.level))),
  ]);

  return outline.levels.map((band, index) => (
    <RouteStop
      aside={t("{count, plural, one {# chapter} other {# chapters}}", {
        count: band.chapters.length,
      })}
      detail={band.chapters
        .slice(0, CHAPTERS_NAMED)
        .map((chapter) => chapter.title)
        .join(CHAPTER_SEPARATOR)}
      key={band.level}
      state={getStopState(index, outline.levels.length)}
      title={levelLabels[index]}
    />
  ));
}

/** A course with a single level lists its first chapters instead of one lonely stop. */
async function ChapterStops({ outline }: { outline: LibraryOutline }) {
  const t = await getExtracted();
  const chapters = outline.levels.flatMap((band) => band.chapters).slice(0, CHAPTERS_LISTED);

  return chapters.map((chapter, index) => (
    <RouteStop
      aside={
        chapter.lessons.length > 0 &&
        t("{count, plural, one {# lesson} other {# lessons}}", { count: chapter.lessons.length })
      }
      key={chapter.id}
      state={index === 0 ? "now" : "future"}
      title={chapter.title}
    />
  ));
}

/**
 * The course at a glance, like the home page's plan: how much there is, and its levels from the
 * first ideas to the most advanced, each with the chapters it starts with.
 */
export async function CourseLevelsCard({ outline }: { outline: LibraryOutline }) {
  const stats = getLibraryOutlineStats(outline);

  const [t, durationLabel] = await Promise.all([
    getExtracted(),
    getTotalDurationLabel(stats.totalMinutes),
  ]);

  return (
    <RouteCard className="lg:mt-3" label={t("Course outline")}>
      <RouteCardEyebrow>{t("Course outline")}</RouteCardEyebrow>
      <RouteCardTitle>
        {t("{count, plural, one {# short lesson} other {# short lessons}}", {
          count: stats.lessonCount,
        })}
      </RouteCardTitle>

      <RouteCardFacts>
        <RouteCardFact icon={<LayersIcon aria-hidden="true" />}>
          {t("{count, plural, one {# chapter} other {# chapters}}", { count: stats.chapterCount })}
        </RouteCardFact>
        <RouteCardFact icon={<ClockIcon aria-hidden="true" />}>{durationLabel}</RouteCardFact>
      </RouteCardFacts>

      <RouteCardDivider />

      <RouteStops>
        {outline.levels.length > 1 ? (
          <LevelStops outline={outline} />
        ) : (
          <ChapterStops outline={outline} />
        )}
      </RouteStops>

      <p className="text-muted-foreground mt-6 flex gap-2 border-t pt-4 text-[13px] leading-snug sm:text-sm">
        <LineMarker>
          <SkipForwardIcon aria-hidden="true" className="size-3.5" />
        </LineMarker>
        <span className="text-pretty">{t("Your plan skips what you already know.")}</span>
      </p>
    </RouteCard>
  );
}
