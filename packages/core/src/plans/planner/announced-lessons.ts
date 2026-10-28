import { toAnnouncedStems, toFormatStems } from "../../library/exams/material-formats";
import { toStems } from "../../library/exams/topic-key";
import { type PlanGraphSkill } from "./plan-state";
import { type PlannerLesson, type QueueUnit } from "./plan-units";

type Named = { id: string; skillIds: readonly string[]; words: readonly string[] };

function findAnnounced({
  announcements,
  named,
}: {
  announcements: readonly string[];
  named: readonly Named[];
}): Set<string> {
  const withStems = named.map((entry) => ({
    entry,
    stems: new Set(entry.words.flatMap((words) => toStems(words))),
  }));

  const stems = new Set(announcements.flatMap((description) => toAnnouncedStems(description)));

  return new Set(
    [...stems].flatMap((stem) => {
      const marked = withStems.filter(({ stems: own }) => own.has(stem)).map(({ entry }) => entry);
      const skills = new Set(marked.flatMap((entry) => entry.skillIds));

      return skills.size === 1 ? marked.map((entry) => entry.id) : [];
    }),
  );
}

function findAnnouncedLessonIds({
  announcements,
  lessons,
}: {
  announcements: readonly string[];
  lessons: readonly PlannerLesson[];
}): Set<string> {
  return findAnnounced({
    announcements,
    named: lessons.map((lesson) => ({
      id: lesson.lessonId,
      skillIds: lesson.skillIds,
      words: [lesson.title],
    })),
  });
}

function findFormatSkillIds({
  announcements,
  skills,
}: {
  announcements: readonly string[];
  skills: readonly Pick<PlanGraphSkill, "name" | "skillId">[];
}): Set<string> {
  const formats = announcements
    .map((description) => toFormatStems(description))
    .filter((stems) => stems.length > 0);

  return new Set(
    skills
      .filter((skill) => {
        const own = new Set(toStems(skill.name));
        return formats.some((stems) => stems.every((stem) => own.has(stem)));
      })
      .map((skill) => skill.skillId),
  );
}

export function findAnnouncedSkillIds({
  announcements,
  skills,
}: {
  announcements: readonly string[];
  skills: readonly Pick<PlanGraphSkill, "name" | "skillId" | "topics">[];
}): Set<string> {
  if (announcements.length === 0) {
    return new Set();
  }

  const asked = findAnnounced({
    announcements,
    named: skills.map((skill) => ({
      id: skill.skillId,
      skillIds: [skill.skillId],
      words: [skill.name, ...(skill.topics ?? [])],
    })),
  });

  return new Set([...asked, ...findFormatSkillIds({ announcements, skills })]);
}

export function markAnnouncedUnits({
  announcements,
  lessons,
  skills,
  units,
}: {
  announcements: readonly string[];
  lessons: readonly PlannerLesson[];
  skills: readonly Pick<PlanGraphSkill, "name" | "skillId" | "topics">[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  // Most goals announce nothing; reading every lesson title anyway cost a real-size exam about 5%
  // of each build.
  if (announcements.length === 0) {
    return [...units];
  }

  const announced = findAnnouncedLessonIds({ announcements, lessons });
  const formatSkills = findFormatSkillIds({ announcements, skills });
  const askedSkills = findAnnouncedSkillIds({ announcements, skills });

  const isAnnounced = (unit: QueueUnit) =>
    unit.lessonId === null
      ? unit.skillId !== null && askedSkills.has(unit.skillId)
      : announced.has(unit.lessonId) || (unit.skillId !== null && formatSkills.has(unit.skillId));

  return units.map((unit) => (isAnnounced(unit) ? { ...unit, announced: true } : unit));
}
