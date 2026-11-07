import { randomUUID } from "node:crypto";
import { shouldWriteInSections } from "./_utils/skill-graph-sections";
import {
  type SkillGraphParams,
  generateSkillGraphFrame,
  generateSkillGraphSection,
  generateWholeSkillGraph,
} from "./skill-graph-calls";
import { runSkillGraphGeneration } from "./skill-graph-generation";

export function generateSkillGraph(params: SkillGraphParams) {
  const analytics =
    shouldWriteInSections(params) || params.findLibrarySkills
      ? { ...params.analytics, traceId: params.analytics?.traceId ?? randomUUID() }
      : params.analytics;

  return runSkillGraphGeneration({
    params: { ...params, analytics },
    tasks: {
      frame: generateSkillGraphFrame,
      section: generateSkillGraphSection,
      whole: generateWholeSkillGraph,
    },
  });
}
