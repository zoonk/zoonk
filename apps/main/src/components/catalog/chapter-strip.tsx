import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref } from "@/lib/public/public-hrefs";
import { getLevelLabels } from "@/lib/public/public-labels";
import { ROUTE_CLASS, getRouteStationClass } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/** How many of the chapters after this one the page links to. */
const NEXT_CHAPTERS = 3;

type OutlineChapter = LibraryOutline["levels"][number]["chapters"][number];

/** A run of the map: a level's chapters, or an exam area's. */
type StripGroup = { chapters: OutlineChapter[]; key: string; label: string };

/** The exam's areas in the order the outline first reaches each, every chapter under its own. */
function groupByArea(chapters: OutlineChapter[], areas: Map<string, string>): StripGroup[] {
  const groups = new Map<string, StripGroup>();

  for (const chapter of chapters) {
    const area = areas.get(chapter.id) ?? "";
    const group = groups.get(area) ?? { chapters: [], key: area, label: area };
    group.chapters.push(chapter);
    groups.set(area, group);
  }

  return [...groups.values()];
}

/**
 * The course as a map of its route: each level (an exam course's area) a zone at its true share of
 * the course, each chapter a station on the pale line through them, this one an ink ring (a
 * visitor's place on a course they haven't started), each zone named with its count under it, or
 * as a key under the map on a phone, where the zones are too narrow for names. Decorative for
 * screen readers, who hear its name instead.
 */
function CourseMap({
  chapterId,
  groups,
  here,
  label,
}: {
  chapterId: string;
  groups: StripGroup[];
  here: StripGroup | undefined;
  label: string;
}) {
  /** A zone's name and count, the zone the chapter is in stronger. */
  const groupName = (group: StripGroup, className?: string) => (
    <span
      className={cn(
        "min-w-0 text-xs leading-4",
        group === here ? "text-foreground font-semibold" : "text-muted-foreground",
        className,
      )}
      key={group.key}
    >
      {group.label}{" "}
      <span className="font-mono font-normal tabular-nums">{group.chapters.length}</span>
    </span>
  );

  return (
    <div aria-label={label} className="flex flex-col gap-2.5" role="img">
      <div className="flex gap-1 sm:gap-1.5">
        {groups.map((group) => (
          <div
            className="flex min-w-0 basis-0 flex-col gap-2"
            key={group.key}
            style={{ flexGrow: group.chapters.length }}
          >
            <span className="bg-ground relative flex h-7 items-center rounded-md px-1 [--route-fill:var(--ground)] sm:px-1.5">
              <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-(--route-line)" />

              {group.chapters.map((chapter) => (
                <span className="relative flex min-w-0 flex-1 justify-center" key={chapter.id}>
                  {chapter.id === chapterId ? (
                    <span className="border-foreground absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-[3px] bg-(--route-fill) sm:size-4" />
                  ) : (
                    <span className="border-subject aspect-square size-1.5 max-w-full rounded-full border-[1.5px] bg-(--route-fill) sm:size-2" />
                  )}
                </span>
              ))}
            </span>

            {groupName(group, "hidden truncate sm:block")}
          </div>
        ))}
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-1 sm:hidden">
        {groups.map((group) => groupName(group))}
      </p>
    </div>
  );
}

/**
 * Where a chapter sits in its course, for a visitor who landed on it from a search: the course's
 * map (`CourseMap`), which screen readers hear as "chapter 12 of 77" (in an exam area, its place
 * there) and its level, then a close-up of its stretch of the route: this chapter and the next ones, one tap each, across on
 * wider screens and down on a phone, the line running on past them. Nothing for a course of one
 * chapter.
 */
export async function ChapterStrip({
  areas = null,
  chapterId,
  outline,
  params,
}: {
  areas?: Map<string, string> | null;
  chapterId: string;
  outline: LibraryOutline;
  params: { brandSlug: string; courseSlug: string };
}) {
  const t = await getExtracted();
  const levelLabels = await getLevelLabels();
  const chapters = outline.levels.flatMap((band) => band.chapters);
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  const chapter = chapters[index];
  const next = chapters.slice(index + 1, index + 1 + NEXT_CHAPTERS);

  const groups: StripGroup[] = areas
    ? groupByArea(chapters, areas)
    : outline.levels.map((band) => ({
        chapters: band.chapters,
        key: band.level,
        label: levelLabels[band.level],
      }));

  const here = groups.find((item) => item.chapters.some((row) => row.id === chapterId));
  const counted = areas && here ? here.chapters : chapters;
  // Unique in the document, which may keep a visited chapter's page beside this one.
  const stripId = `chapter-strip-${chapterId}`;

  // A course of one chapter has nowhere else for it to sit, and no chapter after it.
  if (chapters.length < 2 || !chapter) {
    return null;
  }

  const position = t("Chapter {number} of {total}", {
    number: String(counted.findIndex((row) => row.id === chapterId) + 1),
    total: String(counted.length),
  });

  const stretch = [chapter, ...next];

  return (
    <section aria-labelledby={stripId} className={cn(ROUTE_CLASS, "flex min-w-0 flex-col gap-6")}>
      <h2 className="text-section" id={stripId}>
        {t("Where this chapter sits in the course")}
      </h2>

      <CourseMap
        chapterId={chapterId}
        groups={groups}
        here={here}
        label={here ? `${position} · ${here.label}` : position}
      />

      <nav aria-label={t("After this chapter")}>
        <ol className="grid grid-cols-1 sm:grid-cols-4">
          {stretch.map((item, offset) => {
            const isHere = offset === 0;
            const isLast = offset === stretch.length - 1;

            return (
              <li
                aria-current={isHere ? "page" : undefined}
                className="relative flex gap-3 pb-5 pl-7 last:pb-0 sm:flex-col sm:gap-1 sm:pt-7 sm:pr-4 sm:pb-0 sm:pl-0"
                key={item.id}
              >
                {/* The line on to the next station, down on a phone and across from `sm`; past the last one it fades, the course going on. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 bottom-0 left-2 w-1 -translate-x-1/2 bg-(--route-line)",
                    "sm:top-2 sm:right-0 sm:bottom-auto sm:left-2 sm:h-1 sm:w-auto sm:translate-x-0 sm:-translate-y-1/2",
                    isLast &&
                      "bg-transparent bg-linear-to-b from-(--route-line) to-transparent sm:bg-linear-to-r",
                  )}
                />

                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 left-2 -translate-x-1/2 -translate-y-1/2 bg-(--route-fill)",
                    getRouteStationClass(isHere ? "page" : "stop"),
                  )}
                />

                <span className="text-muted-foreground min-h-4 text-xs leading-4 max-sm:hidden">
                  {isHere && t("This chapter")}
                  {offset === 1 && t("After this chapter")}
                </span>

                {isHere ? (
                  <span className="text-[0.9375rem] leading-snug font-semibold text-pretty">
                    {item.title}
                  </span>
                ) : (
                  <Link
                    className="hover:text-foreground focus-visible:ring-ring/50 -my-2.5 inline-flex min-h-11 items-center self-start rounded-md text-[0.9375rem] leading-snug font-medium text-pretty outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px] sm:-my-3"
                    href={getChapterHref({ ...params, chapterSlug: item.slug })}
                    prefetch
                  >
                    {item.title}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </section>
  );
}
