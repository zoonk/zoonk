import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref } from "@/lib/public/public-hrefs";
import { getLevelLabels } from "@/lib/public/public-labels";
import { ROUTE_CLASS, getRouteStationClass } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

const NEXT_CHAPTERS = 3;

type OutlineChapter = LibraryOutline["levels"][number]["chapters"][number];

type StripGroup = { chapters: OutlineChapter[]; key: string; label: string };

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
  return (
    <div aria-label={label} className="flex flex-col gap-2.5" role="img">
      <div className="flex gap-1 sm:gap-1.5">
        {groups.map((group, index) => (
          <div
            className="flex min-w-0 basis-0 flex-col gap-2 sm:min-w-14"
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
                    <span className="border-subject hidden size-2 rounded-full border-[1.5px] bg-(--route-fill) sm:block" />
                  )}
                </span>
              ))}
            </span>

            <span
              className={cn(
                "hidden min-w-0 flex-col text-xs leading-4 sm:flex",
                index === groups.length - 1 && index > 0 && "items-end text-right",
              )}
            >
              <span
                className={cn(
                  "max-w-full truncate",
                  group === here ? "text-foreground font-semibold" : "text-muted-foreground",
                )}
              >
                {group.label}
              </span>
              <span className="text-muted-foreground font-mono tabular-nums">
                {group.chapters.length}
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs leading-4 sm:hidden">{label}</p>
    </div>
  );
}

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
                className="relative flex flex-col gap-0.5 pb-5 pl-7 last:pb-0 sm:gap-1 sm:pt-7 sm:pr-4 sm:pb-0 sm:pl-0"
                key={item.id}
              >
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

                <span className="text-muted-foreground min-h-4 text-xs leading-4 empty:max-sm:hidden">
                  {isHere && t("This chapter")}
                  {offset === 1 && t("After this chapter")}
                </span>

                {isHere ? (
                  <span className="text-[0.9375rem] leading-snug font-semibold text-pretty">
                    {item.title}
                  </span>
                ) : (
                  <Link
                    className="hover:text-foreground focus-visible:ring-ring/50 hit-area relative self-start rounded-md text-[0.9375rem] leading-snug font-medium text-pretty outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]"
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
