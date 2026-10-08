import { type ExamOutline, isTopicId } from "../exam-outline";
import { type RawSkillGraph } from "./normalize-skill-graph";

/** An exam whose notice has this many subjects or more writes its graph in sections. */
const MIN_SECTIONED_SUBJECTS = 4;

/**
 * At most this many calls write a big exam's skills at once, after its frame: enough that the
 * largest takes a fraction of the whole graph's time, few enough that the notice each one reads
 * again stays a small part of the cost.
 */
const MAX_SECTION_CALLS = 6;

/** One section of a big exam's frame: a notice subject (`S3`) or an area beyond them (`""`). */
export type GraphFrameSection = {
  area: string;
  course: string;
  estimatedLessons: number;
  phases: number[];
  /** How many skills it gets, at the whole graph's granularity. */
  skills: number;
  subject: string;
};

/**
 * Whether a graph is written in sections: an exam read from a notice with several subjects, whose
 * skills split cleanly by subject. A test sized to a lesson budget is written whole, so its sizes
 * add up to the budget.
 */
export function shouldWriteInSections(params: {
  examBlueprint?: ExamOutline;
  lessonBudget?: number | null;
}): boolean {
  return (
    !params.lessonBudget && (params.examBlueprint?.subjects.length ?? 0) >= MIN_SECTIONED_SUBJECTS
  );
}

type SectionCall = { sections: GraphFrameSection[]; skills: number };

/** The call with the fewest skills so far: the next biggest section goes there. */
function findLightest(calls: readonly SectionCall[]): number {
  return calls.reduce(
    (lightest, call, index) => (call.skills < (calls[lightest]?.skills ?? 0) ? index : lightest),
    0,
  );
}

/**
 * The sections each call writes, with about as many skills each, since a call takes as long as
 * the skills it writes: the biggest sections are dealt first, each to the call with the fewest
 * skills so far. Each call keeps its sections in the frame's order.
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

/** The first skill, in its call's order and calls in order, that teaches each topic id. */
function findTopicTeachers(skills: readonly RawSkill[]): Map<string, string> {
  return new Map(
    skills
      .toReversed()
      .flatMap((skill) => skill.topics.map((topic): [string, string] => [topic.trim(), skill.key])),
  );
}

/**
 * The skills of every call as one list, with keys no other call can have (calls write at the same
 * time and may each name a skill `interpret-texts`). A call's prerequisites name its own skills, or
 * a topic id of another call's subject (`S2.4`), which becomes the first skill that teaches that
 * topic: that's how a subject builds on another's foundations.
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
