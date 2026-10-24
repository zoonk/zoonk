import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref } from "@/lib/public/public-hrefs";
import { getLevelLabels } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/** How many of the chapters after this one the page links to. */
const NEXT_CHAPTERS = 3;

/**
 * A chapter after this one: a quiet outlined link, 36px, pressed across 44px (`hit-area`, which the
 * row's 8px gaps leave room for); 44px itself on touch screens.
 */
const NEXT_LINK_CLASS =
  "hit-area ring-input hover:bg-muted focus-visible:ring-ring/50 relative inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-left text-[0.8125rem] leading-snug text-pretty ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px] motion-reduce:transition-none pointer-coarse:min-h-11";

type OutlineChapter = LibraryOutline["levels"][number]["chapters"][number];

/** A run of the strip: a level's chapters, or an exam area's. */
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
 * Where a chapter sits in its course, for a visitor who landed on it from a search: every chapter
 * a segment (no wider than a short course needs), grouped by the course's levels (an exam
 * course's by the exam's areas, `areas`), each group named under its own, this chapter's filled
 * and its group's name in bold, so "chapter 12 of 77" (in an area, its place there) reads at a
 * glance (and is what screen readers hear). Then the next chapters, one tap each. Nothing for a
 * course of one chapter.
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
  const next = chapters.slice(index + 1, index + 1 + NEXT_CHAPTERS);

  const groups: StripGroup[] = areas
    ? groupByArea(chapters, areas)
    : outline.levels.map((band) => ({
        chapters: band.chapters,
        key: band.level,
        label: levelLabels[band.level],
      }));

  const group = groups.find((item) => item.chapters.some((chapter) => chapter.id === chapterId));
  const counted = areas && group ? group.chapters : chapters;
  // Unique in the document, which may keep a visited chapter's page beside this one.
  const stripId = `chapter-strip-${chapterId}`;
  const nextId = `chapter-next-${chapterId}`;

  // A course of one chapter has nowhere else for it to sit, and no chapter after it.
  if (chapters.length < 2) {
    return null;
  }

  const position = t("Chapter {number} of {total}", {
    number: String(counted.findIndex((chapter) => chapter.id === chapterId) + 1),
    total: String(counted.length),
  });

  return (
    <section aria-labelledby={stripId} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-label" id={stripId}>
          {t("Where this chapter sits in the course")}
        </h2>

        {/* Screen readers hear where it sits and in which level, as the strip shows both. */}
        <div
          aria-label={group ? `${position} · ${group.label}` : position}
          className="flex gap-2 sm:gap-3"
          role="img"
        >
          {groups.map((band) => {
            const isHere = band === group;

            return (
              <div
                className="flex min-w-0 flex-col gap-1.5"
                key={band.key}
                style={{ flexBasis: 0, flexGrow: band.chapters.length }}
              >
                <span className="flex gap-px sm:gap-[3px]">
                  {band.chapters.map((chapter) => (
                    <span
                      className={cn(
                        "h-2.5 max-w-6 min-w-0 flex-1 rounded-[2px]",
                        chapter.id === chapterId && "bg-foreground",
                        chapter.id !== chapterId &&
                          (isHere ? "bg-muted-foreground/35" : "bg-surface-3"),
                      )}
                      key={chapter.id}
                    />
                  ))}
                </span>

                <span
                  className={cn(
                    "truncate text-xs",
                    isHere ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {band.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {next.length > 0 && (
        <nav
          aria-labelledby={nextId}
          className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3"
        >
          <h2 className="text-label shrink-0" id={nextId}>
            {t("After this chapter")}
          </h2>

          <ul className="flex flex-wrap gap-2">
            {next.map((chapter) => (
              <li className="max-w-full" key={chapter.id}>
                <Link
                  className={NEXT_LINK_CLASS}
                  href={getChapterHref({ ...params, chapterSlug: chapter.slug })}
                  prefetch
                >
                  {chapter.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
