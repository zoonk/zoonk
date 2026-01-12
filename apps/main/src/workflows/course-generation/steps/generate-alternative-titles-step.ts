import { generateAlternativeTitles } from "@zoonk/ai/alternative-titles/generate";

import { streamStatus } from "../stream-status";

type Input = { title: string; locale: string };

export async function generateAlternativeTitlesStep(
  input: Input,
): Promise<string[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateAlternativeTitles" });

  const { data } = await generateAlternativeTitles({
    locale: input.locale,
    title: input.title,
  });

  await streamStatus({
    status: "completed",
    step: "generateAlternativeTitles",
  });

  return data.alternatives;
}
