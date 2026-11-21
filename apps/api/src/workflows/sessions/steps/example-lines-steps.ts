import {
  type PickedExampleLineFacts,
  listExampleLineLessons,
  pickExampleLineFactsFor,
  writeLessonExampleLines,
} from "@zoonk/core/library/variants/prepare-example-lines";

export async function listExampleLineLessonsStep(input: {
  lessonIds: string[];
  userId: string;
}): Promise<string[]> {
  "use step";

  return listExampleLineLessons(input);
}

export async function pickExampleLineFactsStep(input: {
  firstLessonId: string;
  userId: string;
}): Promise<PickedExampleLineFacts | null> {
  "use step";

  return pickExampleLineFactsFor(input);
}

export async function writeLessonExampleLinesStep(input: {
  lessonId: string;
  picked: PickedExampleLineFacts;
  userId: string;
}): Promise<"refused" | "skipped" | "written"> {
  "use step";

  return writeLessonExampleLines(input);
}
