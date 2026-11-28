import { normalizeString } from "@zoonk/utils/string";
import {
  type ExamOutline,
  canBuildOn,
  findWrittenTaskArea,
  isWrittenTestSubject,
  placeInExam,
} from "../exam-outline";
import { type RawSkillGraph, type SkillGraph } from "./normalize-skill-graph";

type RawSkill = RawSkillGraph["skills"][number];
type Skill = SkillGraph["skills"][number];

export function validateSubjectBinding(skill: RawSkill, outline?: ExamOutline): RawSkill[] {
  const { subject, ...unbound } = skill;

  if (!subject || !outline) {
    return [unbound];
  }

  const placed = placeInExam({ area: skill.area, outline, topics: skill.topics });

  if (outline.subjects.some(({ name }) => name === placed.area)) {
    return [unbound];
  }

  const written = findWrittenTaskArea({ area: skill.area, outline });

  const isOption = outline.subjects.some(
    ({ choiceGroup, name }) => choiceGroup && name === subject,
  );

  return isOption && written?.subjects.includes(subject) ? [skill] : [];
}

export function placeGraphSkill({
  courseTitle,
  outline,
  skill,
}: {
  courseTitle: string;
  outline?: ExamOutline;
  skill: RawSkill;
}): Pick<Skill, "area" | "outcome" | "subject" | "topics"> {
  const area = skill.area.trim() || courseTitle;

  if (!outline || outline.subjects.length === 0) {
    return { area, outcome: skill.outcome, topics: [] };
  }

  const placed = placeInExam({ area, outline, topics: skill.topics });
  const subject = outline.subjects.find((item) => item.name === placed.area);
  const written = findWrittenTaskArea({ area, outline });

  return {
    ...placed,
    outcome:
      skill.outcome ||
      Boolean(subject && isWrittenTestSubject(subject)) ||
      Boolean(written && placed.area === written.area && placed.topics.length === 0),
    ...(skill.subject && { subject: skill.subject }),
  };
}

export function dropChoicePrerequisites({
  outline,
  skills,
}: {
  outline?: ExamOutline;
  skills: Skill[];
}): Skill[] {
  if (!outline?.subjects.some((subject) => subject.choiceGroup)) {
    return skills;
  }

  const subjects = new Map(skills.map((skill) => [skill.key, skill.subject ?? skill.area]));

  return skills.map((skill) => ({
    ...skill,
    prerequisites: skill.prerequisites.filter((key) =>
      canBuildOn({
        area: skill.subject ?? skill.area,
        outline,
        prerequisiteArea: subjects.get(key) ?? "",
      }),
    ),
  }));
}

export function distinguishBoundSkillNames(skills: Skill[]): Skill[] {
  if (!skills.some((skill) => skill.subject)) {
    return skills;
  }

  const byName = Map.groupBy(skills, (skill) => normalizeString(skill.name));

  return skills.map((skill) => {
    const duplicates = byName.get(normalizeString(skill.name)) ?? [];

    return skill.subject && duplicates.length > 1
      ? { ...skill, name: `${skill.name} (${skill.subject})` }
      : skill;
  });
}
