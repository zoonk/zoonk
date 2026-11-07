import { EmptySkillGraphError } from "@zoonk/ai/tasks/curriculum/empty-skill-graph-error";
import { type SkillGraphParams } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { runSkillGraphGeneration } from "@zoonk/ai/tasks/curriculum/skill-graph-generation";
import { safeAsync } from "@zoonk/utils/error";

type Generation = Parameters<typeof runSkillGraphGeneration>[0];

export async function generateGoalSkillGraph({
  model,
  params,
  tasks,
}: Generation & { model?: string }) {
  const generate = (input: SkillGraphParams) => runSkillGraphGeneration({ params: input, tasks });

  if (!model) {
    return generate(params);
  }

  const cheaper = await safeAsync(() => generate({ ...params, model }));

  if (cheaper.data) {
    return cheaper.data;
  }

  if (cheaper.error instanceof EmptySkillGraphError) {
    return generate(params);
  }

  throw cheaper.error;
}
