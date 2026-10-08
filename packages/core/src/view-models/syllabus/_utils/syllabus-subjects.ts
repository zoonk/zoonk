import { toSlug } from "@zoonk/utils/string";
import { namesMatch } from "../../../exams/_utils/name-match";
import { orderByQuestions } from "../../../library/exams/subject-questions";
import { type TopicFrequencySource } from "../../../library/exams/topic-frequency";
import { type SyllabusSubject, type SyllabusView } from "../syllabus-contract";
import { followsNotice, matchAreasToSubjects } from "./match-areas";
import {
  type AreaCourse,
  type NoticeSubject,
  type SyllabusInput,
  type SyllabusSkill,
} from "./syllabus-input";

/** A subject before the plan's lessons are read into it. */
export type SubjectDraft = Pick<
  SyllabusSubject,
  "areas" | "group" | "name" | "questions" | "share" | "source"
> & {
  /** Where how often the exam asks its topics comes from (see `NoticeSubject`). */
  frequencySource?: TopicFrequencySource | null;
  matrix?: readonly string[];
  noticeShortName: string | null;
  /** Areas for one part of the subject's written test (a peça técnica): they don't name it. */
  partAreas?: readonly string[];
  topicFrequency?: NoticeSubject["topicFrequency"];
  topicHeadings?: NoticeSubject["topicHeadings"];
  topics: readonly string[];
};

export function listAreas(skills: readonly SyllabusSkill[]): string[] {
  return [...new Set(skills.map((skill) => skill.area).filter((area) => area.length > 0))];
}

function toModule(area: string): SubjectDraft {
  return {
    areas: [area],
    group: null,
    name: area,
    noticeShortName: null,
    questions: null,
    share: null,
    source: "plan",
    topics: [],
  };
}

/**
 * An area the names don't place that teaches one part of a subject's written test (the plan's
 * "Peça técnica" for the notice's "Prova discursiva", whose test asks a peça técnica) belongs to
 * that subject, when only one subject's test asks it.
 */
function matchWrittenTasks({
  areas,
  matches,
  subjects,
}: {
  areas: readonly string[];
  matches: ReadonlyMap<string, number>;
  subjects: NonNullable<SyllabusInput["notice"]>["subjects"];
}): Map<string, number> {
  return new Map(
    areas.flatMap((area) => {
      if (matches.has(area)) {
        return [];
      }

      const asking = subjects.flatMap((subject, index) =>
        subject.writtenTasks.some((task) => namesMatch(area, task)) ? [index] : [],
      );

      return asking.length === 1 ? [[area, asking[0] ?? 0] as const] : [];
    }),
  );
}

/**
 * The subjects to show: the notice's, in its order, with the plan's areas each gathers and the
 * areas the plan adds outside it after them; or, without a notice the plan follows, its areas.
 */
export function draftSubjects({
  areas,
  notice,
}: {
  areas: string[];
  notice: SyllabusInput["notice"];
}): { drafts: SubjectDraft[]; kind: SyllabusView["kind"] } {
  const subjects = notice?.subjects ?? [];

  const named = matchAreasToSubjects({ areas, subjects: subjects.map((subject) => subject.name) });

  const parts = matchWrittenTasks({ areas, matches: named, subjects });
  const matches = new Map([...named, ...parts]);

  if (subjects.length === 0 || !followsNotice({ areas, matches })) {
    return { drafts: areas.map((area) => toModule(area)), kind: "modules" };
  }

  const fromNotice = orderByQuestions(
    subjects.map((subject, index) => ({
      areas: areas.filter((area) => matches.get(area) === index),
      frequencySource: subject.frequencySource ?? null,
      group: subject.group,
      matrix: subject.matrix,
      name: subject.name,
      noticeShortName: subject.shortName,
      partAreas: areas.filter((area) => parts.get(area) === index),
      questions: subject.questions,
      share: subject.share,
      source: "notice" as const,
      topicFrequency: subject.topicFrequency,
      topicHeadings: subject.topicHeadings,
      topics: subject.topics,
    })),
  );

  const extras = areas.filter((area) => !matches.has(area)).map((area) => toModule(area));

  return { drafts: [...fromNotice, ...extras], kind: "notice" };
}

/**
 * The name labels use for the subject: the notice's own short name when it gives one, else the
 * shortest name it goes by (the notice's, its areas' or their courses'). A course counts only when
 * it names the same subject: a study-strategy area whose first skill sits in a logic course is
 * still study strategy.
 */
export function getShortName({
  areaCourses,
  draft,
}: {
  areaCourses: ReadonlyMap<string, AreaCourse>;
  draft: SubjectDraft;
}): string {
  if (draft.noticeShortName) {
    return draft.noticeShortName;
  }

  const ownNames = [draft.name, ...draft.areas.filter((area) => !draft.partAreas?.includes(area))];

  const courseNames = draft.areas
    .flatMap((area) => areaCourses.get(area)?.title ?? [])
    .filter((title) => ownNames.some((name) => namesMatch(title, name)));

  const names = [...ownNames, ...courseNames].filter((name) => name.trim().length > 0);

  return names.reduce(
    (shortest, name) => (name.length < shortest.length ? name : shortest),
    draft.name,
  );
}

/** Long official names make long addresses: a key keeps the whole words that fit. */
const KEY_MAX_LENGTH = 48;

function toKey(name: string): string {
  const words = name.split(/\s+/u).filter(Boolean);
  const prefixes = words.map((_, index) => toSlug(words.slice(0, index + 1).join(" ")));

  return prefixes.findLast((slug) => slug.length <= KEY_MAX_LENGTH) || toSlug(name) || "subject";
}

/** URL-safe and unique within the syllabus: "lingua-portuguesa", then "lingua-portuguesa-2". */
export function toKeys(names: readonly string[]): string[] {
  const slugs = names.map((name) => toKey(name));

  return slugs.map((slug, index) => {
    const before = slugs.slice(0, index).filter((other) => other === slug).length;
    return before === 0 ? slug : `${slug}-${before + 1}`;
  });
}

/**
 * Each skill's subject by its short name, for labels like a lesson's subject on Today. Empty when
 * the goal has fewer than two subjects (a language, one course), where a label says nothing.
 */
export function getSkillSubjects(
  input: Pick<SyllabusInput, "areaCourses" | "notice" | "skills">,
): Map<string, string> {
  const { drafts } = draftSubjects({ areas: listAreas(input.skills), notice: input.notice });
  const taught = drafts.filter((draft) => draft.areas.length > 0);

  if (taught.length < 2) {
    return new Map();
  }

  const areaNames = new Map(
    taught.flatMap((draft) => {
      const shortName = getShortName({ areaCourses: input.areaCourses, draft });
      return draft.areas.map((area) => [area, shortName] as const);
    }),
  );

  return new Map(
    input.skills.flatMap((skill) => {
      const name = areaNames.get(skill.area);
      return name ? [[skill.skillId, name] as const] : [];
    }),
  );
}
