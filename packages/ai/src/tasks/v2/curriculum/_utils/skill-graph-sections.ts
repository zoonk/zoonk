import { type ExamOutline, isTopicId } from "../exam-outline";
import { type RawSkillGraph } from "./normalize-skill-graph";

const MIN_SECTIONED_SUBJECTS = 4;

/**
 * Enough that the largest call takes a fraction of the graph's time, few enough that the notice
 * each one reads again stays a small part of the cost.
 */
const MAX_SECTION_CALLS = 6;

/** A notice subject (`S3`), or `""` for an area beyond them. */
export type GraphFrameSection = {
  area: string;
  course: string;
  estimatedLessons: number;
  phases: number[];
  skills: number;
  subject: string;
};

/** A test sized to a lesson budget is written whole, so its sizes add up to the budget. */
export function shouldWriteInSections(params: {
  examBlueprint?: ExamOutline;
  lessonBudget?: number | null;
}): boolean {
  return (
    !params.lessonBudget && (params.examBlueprint?.subjects.length ?? 0) >= MIN_SECTIONED_SUBJECTS
  );
}

type SectionCall = { sections: GraphFrameSection[]; skills: number };

function findLightest(calls: readonly SectionCall[]): number {
  return calls.reduce(
    (lightest, call, index) => (call.skills < (calls[lightest]?.skills ?? 0) ? index : lightest),
    0,
  );
}

/**
 * A call takes as long as the skills it writes, so the biggest sections go first to the lightest.
 */
export function toSectionCalls(sections: readonly GraphFrameSection[]): GraphFrameSection[][] {
  const count = Math.min(MAX_SECTION_CALLS, sections.length);
  const order = new Map(sections.map((section, index) => [section, index]));
  const empty: SectionCall[] = Array.from({ length: count }, () => ({ sections: [], skills: 0 }));

  const calls = sections
    .toSorted((a, b) => b.skills - a.skills)
    .reduce((filled, section) => {
      const index = findLightest(filled);

      return filled.map((call, position) =>
        position === index
          ? {
              sections: [...call.sections, section],
              skills: call.skills + Math.max(1, section.skills),
            }
          : call,
      );
    }, empty);

  return calls
    .map((call) => call.sections.toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)))
    .filter((call) => call.length > 0);
}

type RawSkill = RawSkillGraph["skills"][number];

function findTopicTeachers(skills: readonly RawSkill[]): Map<string, string> {
  return new Map(
    skills
      .toReversed()
      .flatMap((skill) => skill.topics.map((topic): [string, string] => [topic.trim(), skill.key])),
  );
}

export function getSectionCall(key: string): number | null {
  const call = /^s(?<call>\d+)-/u.exec(key)?.groups?.call;
  return call ? Number(call) - 1 : null;
}

/**
 * Calls write at once and may name the same key, so keys are made unique. A prerequisite naming
 * another call's topic id (`S2.4`) becomes the first skill that teaches that topic.
 */
export function joinSections(calls: readonly (readonly RawSkill[])[]): RawSkill[] {
  const keyed = calls.flatMap((skills, index) =>
    skills.map((skill) => ({
      ...skill,
      key: `s${index + 1}-${skill.key}`,
      prerequisites: skill.prerequisites.map((key) =>
        isTopicId(key) ? key.trim() : `s${index + 1}-${key}`,
      ),
    })),
  );

  const teachers = findTopicTeachers(keyed);

  return keyed.map((skill) => ({
    ...skill,
    prerequisites: skill.prerequisites.flatMap((key) => {
      const resolved = isTopicId(key) ? teachers.get(key) : key;
      return resolved && resolved !== skill.key ? [resolved] : [];
    }),
  }));
}
