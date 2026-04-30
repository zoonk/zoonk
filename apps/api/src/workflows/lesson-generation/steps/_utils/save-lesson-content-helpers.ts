import { type prisma } from "@zoonk/db";
type StepCreateManyData = NonNullable<Parameters<typeof prisma.step.createMany>[0]>["data"];
type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T extends (infer Item)[] ? Item : T;

export type StepRecord = ArrayItem<StepCreateManyData>;

/**
 * Adds stable IDs to generated options before the player is allowed to shuffle them.
 */
export function addOptionIds<Option extends object>({
  options,
  prefix = "option",
}: {
  options: readonly Option[];
  prefix?: string;
}): (Option & { id: string })[] {
  return options.map((option, index) => ({ ...option, id: `${prefix}-${index + 1}` }));
}

/**
 * Preserves optional question text only when the generated string has content.
 */
export function getOptionalQuestion(question?: string | null): { question?: string } {
  if (!question?.trim()) {
    return {};
  }

  return { question };
}

/**
 * Preserves optional context text only when the generated string has content.
 */
export function getOptionalContext(context?: string | null): { context?: string } {
  if (!context?.trim()) {
    return {};
  }

  return { context };
}
