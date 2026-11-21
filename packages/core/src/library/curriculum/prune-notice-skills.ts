import { normalizeString } from "@zoonk/utils/string";
import { matchAreasToSubjects } from "../../exams/_utils/match-areas";
import { examStructureSchema } from "../exams/blueprint-contract";

type NoticeSkill = {
  area: string | null;
  id: string;
  outcome?: boolean;
  prerequisites?: readonly string[];
  topics?: readonly string[];
};

type NoticeSubject = { name: string; shortName?: string | null; topics: readonly string[] };

export function noticeSubjects(structure: unknown): readonly NoticeSubject[] {
  return (
    examStructureSchema
      .safeParse(structure)
      .data?.subjects.map(({ name, shortName, topics }) => ({
        name,
        shortName: shortName ?? null,
        topics,
      })) ?? []
  );
}

export function findOutsideNoticeSkills({
  protectedIds = new Set<string>(),
  skills,
  subjects,
}: {
  protectedIds?: ReadonlySet<string>;
  skills: readonly NoticeSkill[];
  subjects: readonly NoticeSubject[];
}): string[] {
  const noticeTopics = new Set(subjects.flatMap((subject) => subject.topics.map(normalizeString)));

  const teachesNotice = (skill: NoticeSkill) =>
    skill.topics?.some((topic) => noticeTopics.has(normalizeString(topic))) === true;

  const official = skills.filter((skill) => teachesNotice(skill));

  if (official.length === 0) {
    return [];
  }

  const areas = [...new Set(skills.flatMap((skill) => skill.area || []))];
  const named = matchAreasToSubjects({ areas, subjects });

  const roots = skills.filter(
    (skill) =>
      teachesNotice(skill) ||
      (!protectedIds.has(skill.id) &&
        skill.area !== null &&
        named.has(skill.area) &&
        skill.topics?.length !== 0),
  );

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const kept = new Set<string>();

  function visit(id: string) {
    if (!kept.has(id)) {
      kept.add(id);
      byId.get(id)?.prerequisites?.forEach(visit);
    }
  }

  roots.forEach((skill) => visit(skill.id));

  return skills.flatMap((skill) =>
    kept.has(skill.id) || skill.outcome || protectedIds.has(skill.id) ? [] : [skill.id],
  );
}
