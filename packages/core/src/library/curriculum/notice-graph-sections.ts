import { type ExamOutline, formatExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import {
  type SkillGraphParams,
  type SkillsPart,
} from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { normalizeString } from "@zoonk/utils/string";
import { matchNoticeAreas } from "../../exams/_utils/match-areas";
import { type PlannedSkillGraph } from "./goal-plan-graph";

type Frame = SkillsPart["frame"];

export function listMissingNoticeSubjects({
  graph,
  outline,
}: {
  graph: PlannedSkillGraph;
  outline: ExamOutline;
}): string[] {
  const areas = [...new Set(graph.skills.map((skill) => skill.area))];
  const { matches } = matchNoticeAreas({ areas, subjects: outline.subjects });
  const taught = new Set(matches.values());

  return outline.subjects.flatMap((subject, index) =>
    !taught.has(index) && (subject.topics.length > 0 || subject.writtenTasks?.length)
      ? [`S${index + 1}`]
      : [],
  );
}

export function buildNoticeFramePrompt({
  graph,
  outline,
  params,
}: {
  graph: PlannedSkillGraph;
  outline: ExamOutline;
  params: SkillGraphParams;
}): SkillGraphParams {
  const courses = graph.courses.map(({ title }) => title).join(", ");

  return {
    ...params,
    context: [
      params.context,
      `Existing courses: ${courses}. Keep these where they teach the subject. Add courses for disciplines they do not teach.`,
    ]
      .filter(Boolean)
      .join("\n"),
    examBlueprint: outline,
  };
}

export function extendNoticeFrame({
  draft,
  graph,
  subjects,
}: {
  draft: Frame;
  graph: PlannedSkillGraph;
  subjects: readonly string[];
}): Frame {
  const phases = graph.phases.length > 0 ? graph.phases : draft.phases;
  const courses = [...graph.courses];
  const keys = new Map<string, string>();

  for (const course of draft.courses) {
    const existing = courses.find(
      (item) =>
        item.countrySpecific === course.countrySpecific &&
        normalizeString(item.title) === normalizeString(course.title),
    );

    const key = existing?.key ?? nextCourseKey(courses);
    keys.set(course.key.trim().toLowerCase(), key);

    if (!existing) {
      courses.push({ ...course, key });
    }
  }

  const sections = draft.sections.map((section) => ({
    ...section,
    course: keys.get(section.course.trim().toLowerCase()) ?? courses[0]?.key ?? "",
    phases: [
      ...new Set(
        section.phases.map((phase) => Math.max(1, Math.min(phases.length, Math.round(phase)))),
      ),
    ],
  }));

  if (
    phases.length === 0 ||
    subjects.some((id) => !sections.some((section) => section.subject === id))
  ) {
    throw new Error("The graph frame must include every missing notice subject.");
  }

  return { courses, phases, sections };
}

function nextCourseKey(courses: readonly { key: string }[]): string {
  return (
    Array.from({ length: courses.length + 1 }, (_, index) => `notice-course-${index + 1}`).find(
      (key) => !courses.some((course) => course.key === key),
    ) ?? ""
  );
}

export function toNoticeReferences(outline: ExamOutline) {
  return [{ text: formatExamOutline(outline), title: outline.name }];
}
