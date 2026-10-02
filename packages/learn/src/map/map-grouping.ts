import { type FieldMapView, type MapArea } from "@zoonk/core/view-models/map/contract";

type Counts = MapArea["counts"];

export type MapGroup = {
  areas: MapArea[];
  counts: Counts;
  /** The group's number, which also colors its moon in Fun. */
  index: number;
  key: string;
  state: "current" | "done" | "upcoming";
  title: string;
};

function sumCounts(areas: readonly MapArea[]): Counts {
  const sum = (key: keyof Counts) => areas.reduce((total, area) => total + area.counts[key], 0);

  return {
    fading: sum("fading"),
    learning: sum("learning"),
    mastered: sum("mastered"),
    new: sum("new"),
    solid: sum("solid"),
    total: sum("total"),
  };
}

function getGroupState(areas: readonly MapArea[]): MapGroup["state"] {
  if (areas.some((area) => area.current)) {
    return "current";
  }

  return areas.length > 0 && areas.every((area) => area.state === "done") ? "done" : "upcoming";
}

/** The map by phase, in plan order; a phase without chapters on the map is left out. */
export function groupMapByPhase({
  map,
  phaseTitle,
}: {
  map: Pick<FieldMapView, "areas" | "phases">;
  phaseTitle: (phase: FieldMapView["phases"][number]) => string;
}): MapGroup[] {
  return map.phases.flatMap((phase) => {
    const areas = map.areas.filter((area) => area.phase === phase.index);

    return areas.length > 0
      ? [
          {
            areas,
            counts: sumCounts(areas),
            index: phase.index,
            key: `phase:${phase.index}`,
            state: phase.state,
            title: phaseTitle(phase),
          },
        ]
      : [];
  });
}

/**
 * The map by course, in the order the plan reaches them. Chapters not in a course yet (skills
 * the Library hasn't outlined) come last under `pendingTitle`.
 */
export function groupMapByCourse({
  map,
  pendingTitle,
}: {
  map: Pick<FieldMapView, "areas" | "courses">;
  pendingTitle: string;
}): MapGroup[] {
  const courses = [
    ...map.courses.map((course) => ({ id: course.courseId, title: course.title })),
    { id: null, title: pendingTitle },
  ];

  return courses.flatMap((course, index) => {
    const areas = map.areas.filter((area) => area.courseId === course.id);

    return areas.length > 0
      ? [
          {
            areas,
            counts: sumCounts(areas),
            index,
            key: `course:${course.id ?? "pending"}`,
            state: getGroupState(areas),
            title: course.title,
          },
        ]
      : [];
  });
}
