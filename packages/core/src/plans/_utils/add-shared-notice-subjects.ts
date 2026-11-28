import { normalizeString } from "@zoonk/utils/string";
import { matchAreasToSubjects } from "../../exams/_utils/match-areas";
import { type noticeSubjects } from "../../library/curriculum/prune-notice-skills";
import { addSharedOptionSkills, joinOptionSkills } from "../planner/option-skills";
import { type PlanGraph, type PlanGraphSkill } from "../planner/plan-state";

type SharedNotice = {
  skills: readonly PlanGraphSkill[];
  subjects: ReturnType<typeof noticeSubjects>;
};

function listNoticeSubjects({
  notice,
  skills,
}: {
  notice: SharedNotice;
  skills: readonly PlanGraphSkill[];
}): Set<number> {
  const studied = skills.filter((skill) => !skill.extra);
  const bound = new Set(studied.flatMap((skill) => skill.subject ?? []));
  const topics = new Set(studied.flatMap((skill) => skill.topics?.map(normalizeString) ?? []));

  const named = matchAreasToSubjects({
    areas: [...new Set(studied.flatMap((skill) => skill.area ?? []))],
    subjects: notice.subjects,
  });

  return new Set([
    ...named.values(),
    ...notice.subjects.flatMap((subject, index) =>
      bound.has(subject.name) || subject.topics.some((topic) => topics.has(normalizeString(topic)))
        ? [index]
        : [],
    ),
  ]);
}

/**
 * A subject an earlier reading left out comes back once a corrected reading lists it again: whole
 * when the plan teaches none of it, and skill by skill when a base of it stayed in the plan. A
 * subject the plan teaches with skills of its own gains nothing, since the shared ones would
 * teach it twice.
 */
export function addSharedNoticeSubjects(graph: PlanGraph, notice: SharedNotice): PlanGraph {
  const planned = joinOptionSkills(graph).skills;
  const plannedIds = new Set(planned.map((skill) => skill.skillId));
  const sharedIds = new Set(notice.skills.map((skill) => skill.skillId));
  const taught = listNoticeSubjects({ notice, skills: planned });

  const followed = listNoticeSubjects({
    notice,
    skills: planned.filter((skill) => sharedIds.has(skill.skillId)),
  });

  const taughtTopics = new Set(
    planned.flatMap((skill) => (skill.extra ? [] : (skill.topics?.map(normalizeString) ?? []))),
  );

  const missing = notice.skills.filter((skill) => {
    if (!skill.area || skill.extra || plannedIds.has(skill.skillId)) {
      return false;
    }

    const subjects = [...listNoticeSubjects({ notice, skills: [skill] })];
    const topics = skill.topics ?? [];

    return (
      subjects.some((subject) => !taught.has(subject)) ||
      (topics.length > 0 &&
        subjects.some((subject) => followed.has(subject)) &&
        !topics.some((topic) => taughtTopics.has(normalizeString(topic))))
    );
  });

  if (missing.length === 0) {
    return graph;
  }

  const missingIds = new Set(missing.map((skill) => skill.skillId));

  return addSharedOptionSkills({
    areas: new Set(missing.flatMap((skill) => skill.subject ?? skill.area ?? [])),
    graph,
    shared: {
      phases: [],
      skills: notice.skills.filter(
        (skill) => plannedIds.has(skill.skillId) || missingIds.has(skill.skillId),
      ),
    },
  });
}
