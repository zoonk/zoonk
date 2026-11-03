import { safeAsync } from "@zoonk/utils/error";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { type FinishedGeneration } from "../../../provenance/task-provenance";

export type OnSkillNamed = (name: string) => Promise<void>;

type StreamedPart<TOutput> = {
  [Key in keyof FinishedGeneration]: PromiseLike<FinishedGeneration[Key]>;
} & { output: PromiseLike<TOutput>; partialOutputStream: AsyncIterable<unknown> };

function readSkillName(skill: unknown): string {
  const name = getString(skill, "name");
  return name ? toPlainLine(name) : "";
}

/** A skill's name is complete once the model starts the next skill, or once the output is whole. */
function readCompleteSkillNames({ done, output }: { done: boolean; output: unknown }): string[] {
  const skills: unknown[] =
    isJsonObject(output) && Array.isArray(output.skills) ? output.skills : [];

  const complete = done ? skills : skills.slice(0, -1);

  return complete.map((skill) => readSkillName(skill)).filter(Boolean);
}

/**
 * Reads a streamed call to its end, telling `onSkillNamed` each skill as its name is complete. A
 * callback that fails is ignored: reporting progress never fails or repeats the paid call.
 */
export async function finishStreamedPart<TOutput>({
  generation,
  onSkillNamed,
}: {
  generation: StreamedPart<TOutput>;
  onSkillNamed?: OnSkillNamed;
}) {
  const reported: string[] = [];

  const report = async (names: readonly string[]) => {
    /* eslint-disable no-await-in-loop -- Names are reported in the order the model wrote them */
    for (const name of names.slice(reported.length)) {
      reported.push(name);
      await safeAsync(async () => onSkillNamed?.(name));
    }
  };

  for await (const partial of generation.partialOutputStream) {
    await report(readCompleteSkillNames({ done: false, output: partial }));
  }
  /* eslint-enable no-await-in-loop */

  const [output, finalStep, steps, usage] = await Promise.all([
    generation.output,
    generation.finalStep,
    generation.steps,
    generation.usage,
  ]);

  await report(readCompleteSkillNames({ done: true, output }));

  return { finalStep, output, steps, usage };
}
