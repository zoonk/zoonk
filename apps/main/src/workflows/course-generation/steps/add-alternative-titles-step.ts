import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";

import { streamStatus } from "../stream-status";

type Input = { courseId: number; titles: string[]; locale: string };

export async function addAlternativeTitlesStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addAlternativeTitles" });

  await addAlternativeTitles({
    courseId: input.courseId,
    locale: input.locale,
    titles: input.titles,
  });

  await streamStatus({ status: "completed", step: "addAlternativeTitles" });
}
