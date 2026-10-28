import { type CourseOutlineChapter } from "./course-plan-graph";

export function getChapterAreaFromEvidence({
  chapter,
  skillAreas,
}: {
  chapter: Pick<CourseOutlineChapter, "area" | "lessons" | "tags">;
  skillAreas: ReadonlyMap<string, string | null | undefined>;
}): string | null {
  if (chapter.area !== null && chapter.area !== undefined) {
    return chapter.area;
  }

  const skills = chapter.tags.length > 0 ? chapter.tags : chapter.lessons.flat();
  const areas = new Set(skills.map((skill) => skillAreas.get(skill.id) ?? null));
  return areas.size === 1 ? ([...areas][0] ?? null) : null;
}
