import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { type Citation, type ExamStructure } from "./blueprint-contract";
import { type KeptFacts, keptOr } from "./blueprint-kept";
import { type ExtractionDocument } from "./blueprint-passages";
import { toSubjectTopics } from "./blueprint-subject-topics";

type Extraction = BlueprintExtraction;

function toShortName({ name, shortName }: { name: string; shortName?: string | null }) {
  const short = shortName?.trim();
  return short && short.length < name.trim().length ? short : null;
}

/** A choice's kept count vouches for its options: an option left out of it would be studied by every learner. */
export function toSubject({
  choices,
  documents,
  found,
  groups,
  id,
  item,
  kept,
}: {
  choices: ReadonlySet<string>;
  documents: ExtractionDocument[];
  found: Citation;
  groups: ReadonlySet<string>;
  id: string;
  item: Extraction["subjects"][number];
  kept: KeptFacts;
}): ExamStructure["subjects"][number] {
  const choiceGroup =
    item.choiceGroup && choices.has(item.choiceGroup)
      ? item.choiceGroup
      : keptOr({ gap: null, id: `${id}.choiceGroup`, kept, value: item.choiceGroup });

  const partOf = keptOr({ gap: null, id: `${id}.partOf`, kept, value: item.partOf });
  const group = item.group && groups.has(item.group) ? item.group : null;

  const otherGroups = group
    ? [
        ...new Set(
          item.otherGroups.filter(
            (other, index) => other !== group && kept.has(`${id}.otherGroups.${index}`),
          ),
        ),
      ]
    : [];

  return {
    ...(choiceGroup && { choiceGroup }),
    citation: found,
    group,
    name: item.name,
    ...(otherGroups.length > 0 && { otherGroups }),
    ...(partOf && { partOf }),
    questions: keptOr({ gap: null, id: `${id}.questions`, kept, value: item.questions }),
    shortName: toShortName(item),
    ...toSubjectTopics({ documents, subject: item }),
    weight: keptOr({ gap: null, id: `${id}.weight`, kept, value: item.weight }),
  };
}

export function findKeptGroups({ extraction, kept }: { extraction: Extraction; kept: KeptFacts }) {
  return new Set(
    extraction.subjects.flatMap((subject, index) =>
      subject.group && kept.has(`subjects.${index}.group`) ? [subject.group] : [],
    ),
  );
}
