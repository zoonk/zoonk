import { type CourseOutlineChapter } from "../../goals/_utils/course-plan-graph";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";

export function getCourseEstimateAreas({
  chapters,
  graph,
  structure,
}: {
  chapters: readonly CourseOutlineChapter[];
  graph: PlanGraph;
  structure: unknown;
}): Map<string, string> {
  const areas = [
    ...new Set([
      ...chapters.flatMap((chapter) => chapter.area ?? []),
      ...graph.skills.flatMap((skill) => skill.area ?? []),
    ]),
  ];

  const subjects = examStructureSchema.safeParse(structure).data?.subjects ?? [];
  const matches = matchAreasToSubjects({ areas, subjects });

  return new Map(
    areas.map((area) => {
      const subject = subjects[matches.get(area) ?? -1];

      const parent = subject?.partOf
        ? subjects.find((item) => item.name === subject.partOf)
        : subject;

      return [area, parent?.shortName || parent?.name || area];
    }),
  );
}
