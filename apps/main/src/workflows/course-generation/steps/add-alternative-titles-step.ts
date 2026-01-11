import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";

type Input = { courseId: number; titles: string[]; locale: string };

export async function addAlternativeTitlesStep(input: Input): Promise<void> {
  "use step";

  await addAlternativeTitles({
    courseId: input.courseId,
    locale: input.locale,
    titles: input.titles,
  });
}
