import "server-only";
import { EmptySkillGraphError } from "@zoonk/ai/tasks/curriculum/empty-skill-graph-error";
import {
  type SkillGraphParams,
  type SkillsPart,
  generateSkillGraphFrame,
  generateSkillGraphSection,
  generateWholeSkillGraph,
} from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { safeAsync } from "@zoonk/utils/error";

export function writeSkillGraphFrame(params: SkillGraphParams) {
  return generateSkillGraphFrame(params);
}

export function writeSkillGraphSection(input: { params: SkillGraphParams; part: SkillsPart }) {
  return generateSkillGraphSection(input);
}

export async function writeWholeSkillGraph(params: SkillGraphParams) {
  const { data, error } = await safeAsync(() => generateWholeSkillGraph(params));

  if (data || error instanceof EmptySkillGraphError) {
    return data;
  }

  throw error;
}
