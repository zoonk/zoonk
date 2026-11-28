import { type ExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type ExamBlueprint } from "@zoonk/db";
import { getWrittenTaskOptions } from "../../exams/_utils/written-tasks";
import { listChoiceGroups } from "../../exams/choices/choice-groups";
import { getExamDomainGroups } from "../../plans/planner/exam-domain-size";
import {
  type ExamStructure,
  examStructureSchema,
  topicFrequencySchema,
} from "../exams/blueprint-contract";
import { getSubjectQuestions } from "../exams/subject-questions";
import { listTopicLevels } from "../exams/topic-frequency";

function toExamNotes(structure: ExamStructure | undefined): string[] {
  if (!structure) {
    return [];
  }

  const scoring = structure.mock?.scoring.description;

  return [
    ...structure.formats.map((format) => `Format: ${format.description}`),
    scoring ? `Scoring: ${scoring}` : "",
    ...structure.rules.map((rule) => `Rule: ${rule.text}`),
  ].filter((note) => note.trim().length > 0);
}

export function toExamOutline(
  blueprint: Pick<ExamBlueprint, "name" | "structure" | "topicFrequency">,
): ExamOutline {
  const structure = examStructureSchema.safeParse(blueprint.structure).data;
  const frequency = topicFrequencySchema.safeParse(blueprint.topicFrequency).data ?? [];

  const choices = structure ? listChoiceGroups(structure) : [];
  const writtenTasks = structure ? getWrittenTaskOptions(structure) : [];

  const takenOf = (name?: string | null) => {
    const choice = choices.find((item) => item.name === name);
    return choice ? { choiceTake: choice.take } : {};
  };

  const subjects = structure
    ? structure.subjects.map((subject) => {
        const topicGroups = getExamDomainGroups(subject.topicGroups);

        return {
          choiceGroup: subject.choiceGroup ?? null,
          ...takenOf(subject.choiceGroup),
          group: subject.group ?? null,
          name: subject.name,
          questions: getSubjectQuestions({ structure, subject }),
          shortName: subject.shortName ?? null,
          ...(topicGroups.length > 0 && { topicGroups }),
          topics: subject.topics,
          weight: subject.weight,
          writtenTasks: writtenTasks
            .filter((task) => task.subjects.includes(subject.name))
            .map((task) => task.description),
        };
      })
    : [];

  const looked = structure ? listTopicLevels({ structure, topicFrequency: [] }) : [];

  return {
    name: blueprint.name,
    notes: toExamNotes(structure),
    subjects,
    topicFrequency: [...frequency, ...looked].map(({ level, subject, topic }) => ({
      level,
      subject,
      topic,
    })),
    ...(writtenTasks.length > 0 && { writtenTasks }),
  };
}
