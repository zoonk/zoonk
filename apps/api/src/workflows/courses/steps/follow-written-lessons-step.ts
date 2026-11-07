import { followWrittenLessons } from "@zoonk/core/lookahead/lessons-ask";

export async function followWrittenLessonsStep(input: {
  askedAt: number | null;
  goalId: string;
}): Promise<void> {
  "use step";

  await followWrittenLessons(input);
}
