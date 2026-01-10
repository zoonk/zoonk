import { generateAlternativeTitles } from "@zoonk/ai/alternative-titles/generate";

export async function stepGenerateCourseAlternativeTitles(params: {
  title: string;
  locale: string;
}) {
  "use step";

  const { data } = await generateAlternativeTitles({
    locale: params.locale,
    title: params.title,
  });

  return { data: data.alternatives };
}
