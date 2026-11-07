import { normalizeString } from "@zoonk/utils/string";
import { COURSE_LEVELS, type CourseLevel } from "./course-levels";
import { type RawSkillGraph } from "./normalize-skill-graph";

/** A skill other exams already use (`course` is its course's key). */
export type LibrarySkill = {
  course: string;
  description: string;
  id: string;
  lessons: number;
  level: CourseLevel;
  name: string;
  prerequisiteIds: string[];
};

/**
 * The skills other exams use in the frame's courses and what they build on, with `courses`, the
 * courses outside the frame that hold those foundations.
 */
export type ExamLibrary = { courses: { key: string; title: string }[]; skills: LibrarySkill[] };

type RawSkill = RawSkillGraph["skills"][number];

/** A foundation from another discipline keeps its own course, so the frame gains that course. */
export function addLibraryCourses<TFrame extends Pick<RawSkillGraph, "courses">>({
  frame,
  library,
}: {
  frame: TFrame;
  library: ExamLibrary;
}): TFrame {
  const added = library.courses.map((course) => {
    const levels = new Set(
      library.skills.filter((skill) => skill.course === course.key).map((skill) => skill.level),
    );

    return { ...course, levels: COURSE_LEVELS.filter((level) => levels.has(level)) };
  });

  return { ...frame, courses: [...frame.courses, ...added] };
}

const toRef = (index: number) => `L${index + 1}`;

export function formatLibrarySkills(library: readonly LibrarySkill[]): string {
  if (library.length === 0) {
    return "LIBRARY_SKILLS: none";
  }

  const refs = new Map(library.map((skill, index) => [skill.id, toRef(index)]));

  const courses = [...Map.groupBy(library, (skill) => skill.course)].map(([course, skills]) => {
    const lines = skills.map((skill) => {
      const needs = skill.prerequisiteIds.flatMap((id) => refs.get(id) ?? []);
      const after = needs.length > 0 ? `; needs ${needs.join(", ")}` : "";
      return `  - ${refs.get(skill.id)}: ${skill.name} (${skill.level}, ${skill.lessons} lessons${after}): ${skill.description}`;
    });

    return [`- ${course}:`, ...lines].join("\n");
  });

  return `LIBRARY_SKILLS:\n${courses.join("\n")}`;
}

function findReused({
  byRef,
  reuse,
}: {
  byRef: ReadonlyMap<string, LibrarySkill>;
  reuse: string | null | undefined;
}): LibrarySkill | null {
  return reuse ? (byRef.get(normalizeString(reuse).toUpperCase()) ?? null) : null;
}

function toReusedSkill({ library, skill }: { library: LibrarySkill; skill: RawSkill }): RawSkill {
  return {
    ...skill,
    course: library.course,
    description: library.description,
    estimatedLessons: library.lessons,
    level: library.level,
    libraryId: library.id,
    name: library.name,
    prerequisites: [],
  };
}

/** A reused skill's prerequisites come with it, in the area of the first skill that needs them. */
function addMissingPrerequisites({
  byId,
  skills,
}: {
  byId: ReadonlyMap<string, LibrarySkill>;
  skills: readonly RawSkill[];
}): RawSkill[] {
  const keys = new Map(
    skills.flatMap((skill) => (skill.libraryId ? [[skill.libraryId, skill.key]] : [])),
  );

  const added: RawSkill[] = [];

  const visit = (skill: RawSkill) => {
    for (const id of byId.get(skill.libraryId ?? "")?.prerequisiteIds ?? []) {
      const library = byId.get(id);

      if (library && !keys.has(id)) {
        const prerequisite = toReusedSkill({
          library,
          skill: { ...skill, examWeight: 1, key: `library-${id}`, outcome: false, topics: [] },
        });

        keys.set(id, prerequisite.key);
        added.push(prerequisite);
        visit(prerequisite);
      }
    }
  };

  skills.forEach((skill) => visit(skill));

  return [...skills, ...added].map((skill) => {
    const library = skill.libraryId ? byId.get(skill.libraryId) : undefined;

    return library
      ? { ...skill, prerequisites: library.prerequisiteIds.flatMap((id) => keys.get(id) ?? []) }
      : skill;
  });
}

/**
 * A reused skill keeps what the Library says it is, its prerequisite links included; the exam
 * gives only its area, topics, phase and weight. A reuse id the list doesn't have is a new skill.
 */
export function applyLibraryReuse({
  library,
  skills,
}: {
  library: readonly LibrarySkill[];
  skills: readonly RawSkill[];
}): RawSkill[] {
  if (library.length === 0) {
    return [...skills];
  }

  const byRef = new Map(library.map((skill, index) => [toRef(index), skill]));
  const byId = new Map(library.map((skill) => [skill.id, skill]));

  const reused = skills.map((skill) => {
    const found = findReused({ byRef, reuse: skill.reuse });
    return found ? toReusedSkill({ library: found, skill }) : skill;
  });

  return addMissingPrerequisites({ byId, skills: reused });
}
