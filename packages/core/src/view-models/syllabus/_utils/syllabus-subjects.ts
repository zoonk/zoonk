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

export type SubjectDraft = Pick<
  SyllabusSubject,
  "areas" | "group" | "name" | "questions" | "share" | "source"
> & {
  frequencySource?: TopicFrequencySource | null;
  matrix?: readonly string[];
  noticeShortName: string | null;
  /** Written-task and selected-option areas counted inside this subject. */
  partAreas?: readonly string[];
  partOf?: NoticeSubject["partOf"];
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

/** Assign a written-task area only when exactly one subject's test asks it. */
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

function addCounts(first: number | null, second: number | null): number | null {
  return first === null || second === null ? first : first + second;
}

function addParts({ parts, whole }: { parts: readonly SubjectDraft[]; whole: SubjectDraft }) {
  if (parts.length === 0) {
    return whole;
  }

  const sum = (key: "questions" | "share") =>
    parts.reduce<number | null>((total, part) => addCounts(total, part[key]), whole[key]);

  const partAreas = parts.flatMap((part) => part.areas);

  return {
    ...whole,
    areas: [...whole.areas, ...partAreas],
    partAreas: [...(whole.partAreas ?? []), ...partAreas],
    questions: sum("questions"),
    share: sum("share"),
    topicFrequency: new Map([
      ...(whole.topicFrequency ?? []),
      ...parts.flatMap((part) => [...(part.topicFrequency ?? [])]),
    ]),
    topicHeadings: new Map([
      ...(whole.topicHeadings ?? []),
      ...parts.flatMap((part) => part.topics.map((topic) => [topic, part.name] as const)),
    ]),
    topics: [...whole.topics, ...parts.flatMap((part) => part.topics)],
  };
}

/** Selected options remain separate teaching areas but count within their parent notice subject. */
function foldPartsIntoSubjects(drafts: readonly SubjectDraft[]): SubjectDraft[] {
  const names = new Set(drafts.map((draft) => draft.name));
  const isPart = (draft: SubjectDraft) => Boolean(draft.partOf && names.has(draft.partOf));

  return drafts
    .filter((draft) => !isPart(draft))
    .map((whole) =>
      addParts({
        parts: drafts.filter((part) => isPart(part) && part.partOf === whole.name),
        whole,
      }),
    );
}

/** Preserves notice order and appends outside areas; selected options stay within their parent subject. */
export function draftSubjects({
  areas,
  notice,
}: {
  areas: string[];
  notice: SyllabusInput["notice"];
}): { drafts: SubjectDraft[]; kind: SyllabusView["kind"] } {
  const subjects = notice?.subjects ?? [];

  const named = matchAreasToSubjects({ areas, subjects });

  const parts = matchWrittenTasks({ areas, matches: named, subjects });
  const matches = new Map([...named, ...parts]);

  if (subjects.length === 0 || !followsNotice({ areas, matches })) {
    return { drafts: areas.map((area) => toModule(area)), kind: "modules" };
  }

  const fromNotice = orderByQuestions(
    foldPartsIntoSubjects(
      subjects.map((subject, index) => ({
        areas: areas.filter((area) => matches.get(area) === index),
        frequencySource: subject.frequencySource ?? null,
        group: subject.group,
        matrix: subject.matrix,
        name: subject.name,
        noticeShortName: subject.shortName,
        partAreas: areas.filter((area) => parts.get(area) === index),
        partOf: subject.partOf ?? null,
        questions: subject.questions,
        share: subject.share,
        source: "notice" as const,
        topicFrequency: subject.topicFrequency,
        topicHeadings: subject.topicHeadings,
        topics: subject.topics,
      })),
    ),
  );

  const extras = areas.filter((area) => !matches.has(area)).map((area) => toModule(area));

  return { drafts: [...fromNotice, ...extras], kind: "notice" };
}

/** Prefer the notice's short name; course names qualify only when they name the same subject. */
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

/** Returns no labels when fewer than two subjects make them useful. */
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
