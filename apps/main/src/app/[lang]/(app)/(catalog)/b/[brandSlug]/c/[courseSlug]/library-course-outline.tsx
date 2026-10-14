import { type PaceEstimate, isDatedEstimate } from "@/components/catalog/plan-estimate";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import {
  getLevelLabels,
  getMinutesFormatter,
  getTotalDurationLabel,
} from "@/lib/public/public-labels";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "@zoonk/learn/page";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { AreaOutline, type DatedPace } from "./outline-areas";
import { PaceMarks } from "./outline-chapter-row";
import { OutlineLevel } from "./outline-levels";

type Params = { brandSlug: string; courseSlug: string };

/**
 * The example plan the outline marks: the plan window's paces, whose radios (`paceSwitch`) switch
 * the marks too, the one the window picks first, and the exam's first day as the page writes it,
 * for an exam course.
 */
export type OutlinePlan = {
  defaultMinutes: number;
  examDate: string | null;
  paceSwitch: string;
  paces: PaceEstimate[];
};

/**
 * How the outline shows the example plan: by the exam's areas when every pace reads an exam course
 * against its date, as weeks on the levels when every pace plans the course to its end, or not at
 * all.
 */
function getOutlineMarks(
  plan: OutlinePlan | null,
):
  | { kind: "areas"; paces: DatedPace[] }
  | { kind: "none" }
  | { kind: "weeks"; paces: PaceEstimate[] } {
  const paces = plan?.paces ?? [];

  const dated = paces.flatMap((pace) =>
    isDatedEstimate(pace.estimate) ? [{ estimate: pace.estimate, minutes: pace.minutes }] : [],
  );

  if (paces.length === 0) {
    return { kind: "none" };
  }

  if (dated.length === 0) {
    return { kind: "weeks", paces };
  }

  return dated.length === paces.length ? { kind: "areas", paces: dated } : { kind: "none" };
}

/**
 * What the example plan comes to over the outline, at the picked pace: to the course's end from
 * scratch, or to the exam's day.
 */
async function OutlinePlanLine({ plan }: { plan: OutlinePlan }) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();

  return (
    <p className="text-muted-foreground -mt-2 text-sm leading-relaxed text-pretty">
      <PaceMarks
        marks={plan.paces.map((pace) => ({
          minutes: pace.minutes,
          text:
            isDatedEstimate(pace.estimate) && plan.examDate
              ? t("Your plan until {date}, at {time} a day", {
                  date: plan.examDate,
                  time: minutesText(pace.minutes),
                })
              : t(
                  "Your plan at {minutes, plural, one {# minute} other {# minutes}} a day, from scratch",
                  { minutes: pace.minutes },
                ),
        }))}
        paceSwitch={plan.paceSwitch}
      />
    </p>
  );
}

/**
 * One column under the hero; from `xl`, where the page is wider than a list should read, the
 * outline takes the page's width with its title, size, plan line and description in a column
 * beside the levels (kept in view while they scroll), as the pricing questions sit beside their
 * title.
 */
const OUTLINE_SECTION_CLASS =
  "max-w-[760px] xl:grid xl:max-w-wide xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:items-start xl:gap-x-12";

/** The outline's words: in the section's own flow until `xl`, then its column beside the levels. */
const OUTLINE_INTRO_CLASS = "contents xl:sticky xl:top-24 xl:flex xl:flex-col xl:gap-3";

/**
 * Everything the course covers, after the page has said what it is and how it becomes a plan: its
 * size in one quiet line (chapters, then lessons and their total time once they're written), its
 * description, then its levels, each folded to its name and first chapters, the first one open.
 * With the example plan (`plan`), each chapter says its week in it at the pace the window's radios
 * pick, and an exam course read against its date groups its chapters by the exam's areas, each
 * saying how much of it fits. Every chapter and lesson title stays in the page's HTML once for
 * search engines, and each opens its own page. A course whose outline isn't written yet invites
 * the visitor to build their plan, which writes it for them.
 */
export async function LibraryCourseOutline({
  courseId,
  lead,
  outline,
  params,
  plan = null,
}: {
  courseId: string;
  lead: string | null;
  outline: LibraryOutline;
  params: Params;
  plan?: OutlinePlan | null;
}) {
  const t = await getExtracted();
  const stats = getLibraryOutlineStats(outline);
  const durationLabel = await getTotalDurationLabel(stats.totalMinutes);
  const levelLabels = await getLevelLabels();
  const marks = stats.chapterCount > 0 ? getOutlineMarks(plan) : ({ kind: "none" } as const);

  const firstNumbers = outline.levels.map((_, index) =>
    outline.levels.slice(0, index).reduce((sum, band) => sum + band.chapters.length, 1),
  );

  const titleId = `course-outline-${courseId}`;

  return (
    <PageSection aria-labelledby={titleId} className={OUTLINE_SECTION_CLASS}>
      <div className={OUTLINE_INTRO_CLASS}>
        <PageSectionHeader>
          <PageSectionTitle id={titleId}>{t("Course outline")}</PageSectionTitle>

          {stats.chapterCount > 0 && (
            <PageSectionDetail>
              {[
                t("{count, plural, one {# chapter} other {# chapters}}", {
                  count: stats.chapterCount,
                }),
                stats.lessonCount > 0 &&
                  t("{count, plural, one {# short lesson} other {# short lessons}}", {
                    count: stats.lessonCount,
                  }),
                stats.lessonCount > 0 && durationLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </PageSectionDetail>
          )}
        </PageSectionHeader>

        {plan && marks.kind !== "none" && <OutlinePlanLine plan={plan} />}

        {lead && (
          <p className="max-w-column text-[0.9375rem] leading-relaxed text-pretty">{lead}</p>
        )}

        {stats.chapterCount === 0 && (
          <p className="max-w-column flex gap-2.5 text-[0.9375rem] leading-relaxed text-pretty">
            <LineMarker>
              <SparklesIcon aria-hidden="true" className="text-muted-foreground size-4" />
            </LineMarker>
            <span>
              {t(
                "Build your plan and Zoonk writes this course's chapters and lessons for you, starting at your level.",
              )}
            </span>
          </p>
        )}
      </div>

      {plan && marks.kind === "areas" && (
        <AreaOutline
          defaultMinutes={plan.defaultMinutes}
          outline={outline}
          paceSwitch={plan.paceSwitch}
          paces={marks.paces}
          params={params}
        />
      )}

      {stats.chapterCount > 0 && marks.kind !== "areas" && (
        <div className="flex flex-col">
          {outline.levels.map((band, index) => (
            <OutlineLevel
              band={band}
              firstNumber={firstNumbers[index] ?? 1}
              key={band.level}
              label={levelLabels[band.level]}
              open={index === 0}
              params={params}
              plan={plan && marks.kind === "weeks" ? { ...plan, paces: marks.paces } : null}
            />
          ))}
        </div>
      )}
    </PageSection>
  );
}
