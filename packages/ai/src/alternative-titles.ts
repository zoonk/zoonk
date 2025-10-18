import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./alternative-titles.md";

const schema = z.object({
  alternatives: z.array(z.string()),
});

export type AlternativeTitlesSchema = z.infer<typeof schema>;

export type AlternativeTitlesParams = {
  title: string;
  model: string;
};

export async function generateAlternativeTitles({
  title,
  model,
}: AlternativeTitlesParams) {
  const userPrompt = `TITLE: ${title}`;

  const { object, usage } = await generateObject({
    model,
    schema,
    prompt: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return { data: object, usage, userPrompt, systemPrompt };
}
