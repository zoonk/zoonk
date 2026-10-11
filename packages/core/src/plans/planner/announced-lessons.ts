import { toAnnouncedStems, toFormatStems } from "../../library/exams/material-formats";
import { toStems } from "../../library/exams/topic-key";
import { type PlanGraphSkill } from "./plan-state";
import { type PlannerLesson, type QueueUnit } from "./plan-units";

/** Something an announced question may be about, with the words it's named by and its skills. */
type Named = { id: string; skillIds: readonly string[]; words: readonly string[] };

/**
 * What a class test's announced questions are about: each word of what a question is about marks
 * what's named with it, when all of that teaches one skill. A word several skills share
 * ("cell") says nothing about which one the question asks.
 */
function findAnnounced({
  announcements,
  named,
}: {
  /** What the questions the learner's material announces are, as its formats describe them. */
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

/**
 * The lessons on what a class test's announced questions ask ("an essay on osmosis":
 * "Osmosis in animal and plant cells"), by their titles. A plan short on time keeps these
 * lessons with their skill's core (see `putCoresFirst`): Pedro's 30-minute plan cut the osmosis
 * lesson his teacher announced an essay on, after the skill's first lesson.
 */
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

/**
 * The skills that practice a format a class test's material announces, by their names: Pedro's
 * graph has "Fill in tables of organelle functions" for "a question to fill in the organelles
 * table" and "Write an essay answer…" for "an essay on osmosis". A reading
 * that keeps only the format ("Fill-in-the-table question.") still finds them, and a plan short
 * on time keeps all their lessons: they rehearse the very questions the teacher announced.
 */
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

/**
 * The skills a class test's announced questions ask about, by their names and the topics of the
 * learner's material they teach ("fill in the organelles table": "Organelles"), and the ones
 * practicing an announced format (see `findFormatSkillIds`): one the learner already knows keeps
 * its practice whatever the time (see `loadPracticeClaims`).
 */
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

/**
 * The plan's units with the ones on what a class test's material announces marked `announced`: a
 * lesson on an announced question's topic (see `findAnnouncedLessonIds`), every lesson of a
 * skill practicing an announced format (see `findFormatSkillIds`), and a stand-in of a skill the
 * announcements ask about (see `findAnnouncedSkillIds`): with no lesson written yet, its skill is
 * all there is to read, and "an essay on osmosis" left Pedro's osmosis skill out for unannounced
 * cell theory. A plan short on time keeps them with their skill's core (see `putCoresFirst`),
 * whatever else it focuses on.
 */
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
  // Most goals announce nothing, and reading every lesson title for it cost a real-size exam about
  // 5% of each plan it builds.
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
