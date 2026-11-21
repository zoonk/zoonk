import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type ExamPicks } from "../../choices/exam-choices";
import { getWritingScope, writingNeedsChoice } from "../../essays/_utils/writing-scope";
import { type MockOptionView, type MockShape } from "../mock-contract";
import { getDayWrittenParts } from "../written-parts";

function listWaitingParts({
  picks,
  shape,
  structure,
}: {
  picks: ExamPicks;
  shape: Pick<MockShape, "day" | "kind">;
  structure: ExamStructure | null;
}) {
  if (!structure || (shape.kind !== "full" && shape.kind !== "written")) {
    return [];
  }

  return getDayWrittenParts({ day: shape.day, structure }).map(({ name, tasks }) => ({
    availability: writingNeedsChoice(
      tasks.flatMap((task) => getWritingScope({ picks, structure, task }).missingChoices),
    ),
    name,
  }));
}

export function getMockWritingAvailability(input: Parameters<typeof listWaitingParts>[0]) {
  return writingNeedsChoice(
    listWaitingParts(input).flatMap(({ availability }) => availability?.choiceGroups ?? []),
  );
}

export function withMockWritingAvailability({
  option,
  picks,
  structure,
}: Omit<Parameters<typeof listWaitingParts>[0], "shape"> & {
  option: MockOptionView;
}): MockOptionView {
  const parts = listWaitingParts({ picks, shape: option, structure });

  const availability = writingNeedsChoice(
    parts.flatMap((part) => part.availability?.choiceGroups ?? []),
  );

  return availability
    ? {
        ...option,
        availability,
        sections: option.sections?.map((section) => {
          const waiting = parts.find(({ name }) => name === section.name)?.availability;

          return section.kind === "written" && waiting
            ? { ...section, availability: waiting }
            : section;
        }),
      }
    : option;
}
