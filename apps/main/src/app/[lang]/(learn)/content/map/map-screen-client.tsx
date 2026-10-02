"use client";

import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { useGoToStudyDestination } from "@/lib/session/use-study-navigation";
import { type FieldMapView } from "@zoonk/core/view-models/map/contract";
import { type FieldMapActions, type FieldMapHrefs, FieldMapScreen } from "@zoonk/learn/map";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { continueNextLevelAction, refreshFadingAction } from "./map-actions";

const MAP_HREFS: FieldMapHrefs = {
  back: "/content",
  chapterBasePath: "/content/chapters",
  course: getCourseHref,
};

/** The map with "Refresh now" and "Continue at…" wired to core, in the learner's timezone. */
export function MapScreenClient({ map }: { map: FieldMapView }) {
  const go = useGoToStudyDestination();
  const router = useRouter();
  const goalId = map.goal.id;

  const actions: FieldMapActions = {
    continueNextLevel: async () => {
      const started = await continueNextLevelAction(goalId);

      if (started) {
        router.push("/plan");
      }

      return started;
    },
    refresh: async () => {
      const result = await refreshFadingAction(goalId, { timeZone: getLocalTimeZone() });

      if (result.outcome === "started") {
        await go(result.destination);
      }

      return result.outcome;
    },
  };

  return <FieldMapScreen actions={actions} hrefs={MAP_HREFS} map={map} />;
}
