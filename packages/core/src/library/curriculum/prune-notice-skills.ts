import { normalizeString } from "@zoonk/utils/string";
import { matchNoticeAreas } from "../../exams/_utils/match-areas";

type NoticeSkill = {
  area: string | null;
  id: string;
  outcome?: boolean;
  prerequisites?: readonly string[];
  topics?: readonly string[];
};

type NoticeSubject = {
  name: string;
  shortName?: string | null;
  topics: readonly string[];
  writtenTasks?: readonly string[];
};

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
  const { matches, named } = matchNoticeAreas({ areas, subjects });

  const roots = [
    ...official,
    ...skills.filter(
      (skill) =>
        !protectedIds.has(skill.id) &&
        skill.area !== null &&
        ((skill.topics === undefined && named.has(skill.area)) ||
          (skill.outcome && matches.has(skill.area))),
    ),
  ];

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
    kept.has(skill.id) || protectedIds.has(skill.id) ? [] : [skill.id],
  );
}
