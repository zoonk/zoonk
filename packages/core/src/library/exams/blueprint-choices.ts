import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { type FactEntry, type FactSource, toFacts } from "./blueprint-fact-claims";
import { type KeptFacts } from "./blueprint-kept";
import { toPartPassages } from "./blueprint-passages";

type Extraction = BlueprintExtraction;
type Subject = Extraction["subjects"][number];

/** The count of a choice that takes several is its own claim: an option taken alone, such as a double-size one, would fail it. */
export function describeChoice({
  extraction,
  name,
  subject,
}: {
  extraction: Extraction;
  name: string;
  subject: Subject;
}): string {
  const isSeveral = extraction.choiceGroups.some((group) => group.name === subject.choiceGroup);

  return isSeveral
    ? `${name} is one of the options of "${subject.choiceGroup}"`
    : `${name} is one of the options of "${subject.choiceGroup}", of which each candidate takes only one`;
}

export function choiceFacts({ documents, extraction, found }: FactSource): FactEntry[] {
  return extraction.choiceGroups.flatMap((group, index) =>
    toFacts({
      claims: [
        {
          id: `choiceGroups.${index}`,
          statement: `Each candidate takes ${group.take} of the options of "${group.name}"`,
        },
      ],
      documents,
      passages: toPartPassages({ found, name: group.name, own: group.passages }),
    }),
  );
}

export function toChoiceGroups({ extraction, kept }: { extraction: Extraction; kept: KeptFacts }) {
  return extraction.choiceGroups.flatMap((group, index) =>
    kept.has(`choiceGroups.${index}`) && group.take > 1
      ? [{ name: group.name, take: group.take }]
      : [],
  );
}
