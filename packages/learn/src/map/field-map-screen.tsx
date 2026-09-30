"use client";

import { type FieldMapView } from "@zoonk/core/view-models/map/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { BuiltFromCourse, isCourseSubset } from "../course/built-from-course";
import { CourseLevelsLadder } from "../course/course-levels";
import { LearnLink } from "../learn-link";
import {
  type FieldMapActions,
  type FieldMapHrefs,
  FieldMapProvider,
  useFieldMap,
} from "./field-map-context";
import { groupMapByCourse, groupMapByPhase } from "./map-grouping";
import { MapGroups } from "./map-groups";
import { MapLegend } from "./map-legend";
import { RefreshCard } from "./refresh-card";
import { StudyNext } from "./study-next";

export type { FieldMapActions, FieldMapHrefs } from "./field-map-context";

function MapHeader() {
  const t = useExtracted();
  const { hrefs, map } = useFieldMap();

  return (
    <header className="flex flex-col gap-3">
      <LearnLink
        className={cn(
          buttonVariants({ size: "sm", variant: "ghost" }),
          "in-data-[mode=fun]:fun-glass -ml-2 self-start",
        )}
        href={hrefs.back}
      >
        <ChevronLeftIcon aria-hidden="true" />
        {t("Content")}
      </LearnLink>

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{map.goal.title}</p>
        <h1 className="in-data-[mode=fun]:font-fun-display text-3xl font-bold tracking-tight">
          {t("Map of your subject")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            "{total, plural, one {# skill} other {# skills}} · {mastered, number} mastered · {fading, number} fading",
            { fading: map.counts.fading, mastered: map.counts.mastered, total: map.counts.total },
          )}
        </p>
      </div>
    </header>
  );
}

function usePhaseTitle() {
  const t = useExtracted();

  return (phase: FieldMapView["phases"][number]) =>
    phase.name
      ? t("Phase {number, number}: {name}", { name: phase.name, number: phase.index + 1 })
      : t("Phase {number, number}", { number: phase.index + 1 });
}

/** The map by phase, or by course when the plan spans several courses. */
function MapZoom() {
  const t = useExtracted();
  const phaseTitle = usePhaseTitle();
  const { map } = useFieldMap();
  const byPhase = groupMapByPhase({ map, phaseTitle });

  if (map.courses.length < 2) {
    return <MapGroups groups={byPhase} label={t("Phases")} />;
  }

  const byCourse = groupMapByCourse({ map, pendingTitle: t("Not in a course yet") });

  return (
    <Tabs defaultValue="phases">
      <TabsList aria-label={t("Group the map")} className="w-full group-data-horizontal/tabs:h-11">
        <TabsTrigger value="phases">{t("By phase")}</TabsTrigger>
        <TabsTrigger value="courses">{t("By course")}</TabsTrigger>
      </TabsList>
      <TabsContent className="pt-3" value="phases">
        <MapGroups groups={byPhase} label={t("Phases")} />
      </TabsContent>
      <TabsContent className="pt-3" value="courses">
        <MapGroups groups={byCourse} label={t("Courses")} />
      </TabsContent>
    </Tabs>
  );
}

/** The course the plan is built from, and the subject's levels with the plan's marked. */
function MapCourse() {
  const { hrefs, map } = useFieldMap();
  const { course } = map;

  if (!course) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {isCourseSubset(course) && course.brandSlug && (
        <BuiltFromCourse
          course={course}
          courseHref={hrefs.course({ brandSlug: course.brandSlug, courseSlug: course.courseSlug })}
        />
      )}
      <CourseLevelsLadder course={course} />
    </div>
  );
}

function FieldMapBody() {
  const { map } = useFieldMap();

  return (
    <div className="flex flex-col gap-6" data-slot="field-map">
      <MapHeader />
      {map.refresh.emphasized && <RefreshCard />}
      <StudyNext />
      {!map.refresh.emphasized && <RefreshCard />}

      <div className="flex flex-col gap-3">
        <MapLegend />
        <MapZoom />
      </div>

      <MapCourse />
    </div>
  );
}

/**
 * The map of the subject, in Focus and Fun alike: every skill of the goal drawn from its skill
 * graph (never a picture), grouped by phase or course with only where the learner is open, each
 * skill's mastery by shape and tone, refresh mode for what's fading, and, once the plan is done,
 * what to study next with one tap to continue at the next level.
 *
 * ```tsx
 * <FieldMapScreen actions={actions} hrefs={hrefs} map={map} />
 * ```
 */
export function FieldMapScreen({
  actions,
  hrefs,
  map,
}: {
  actions: FieldMapActions;
  hrefs: FieldMapHrefs;
  map: FieldMapView;
}) {
  return (
    <FieldMapProvider value={{ actions, hrefs, map }}>
      <FieldMapBody />
    </FieldMapProvider>
  );
}
