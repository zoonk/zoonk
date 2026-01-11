import { generateAlternativeTitles } from "@zoonk/ai/alternative-titles/generate";

type Input = { title: string; locale: string };

export async function generateAlternativeTitlesStep(
  input: Input,
): Promise<string[]> {
  "use step";

  const { data } = await generateAlternativeTitles({
    locale: input.locale,
    title: input.title,
  });

  return data.alternatives;
}
