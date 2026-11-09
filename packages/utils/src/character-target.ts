import { type z } from "zod";

/**
 * A length a model aims for, which it reads in the schema it writes to. Nothing rejects or cuts text
 * that runs over: a clear text a little long beats one rewritten or cut to fit.
 */
export function aimForCharacters<TSchema extends z.ZodString>(schema: TSchema, characters: number) {
  return schema.describe(`Aim for ${characters} characters or fewer.`);
}
