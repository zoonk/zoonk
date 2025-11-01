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
    prompt: [
      { content: systemPrompt, role: "system" },
      { content: userPrompt, role: "user" },
    ],
    schema,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}
