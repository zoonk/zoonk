import { toStems } from "../../library/exams/topic-key";
import { type PlanOperation } from "../plan-contract";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanContext } from "./plan-context";

type FocusOperation = Extract<PlanOperation, { kind: "focusAreas" }>;

function listSkillStems(context: PlanContext): { skillId: string; stems: Set<string> }[] {
  return context.state.graph.skills.map((skill) => {
    const titles = context.items
      .filter((item) => item.skillId === skill.skillId)
      .map((item) => item.titleSnapshot);

    return {
      skillId: skill.skillId,
      stems: new Set(
        [skill.name, ...(skill.topics ?? []), ...titles].flatMap((text) => toStems(text)),
      ),
    };
  });
}

function findTopicWords({
  request,
  skills,
}: {
  request: string;
  skills: readonly { skillId: string; stems: Set<string> }[];
}): { skillIds: Set<string>; words: string[] } {
  const words = [...new Set(request.split(/[^\p{L}\p{N}]+/u))].flatMap((word) => {
    const [stem] = toStems(word);
    const named = stem ? skills.filter((skill) => skill.stems.has(stem)) : [];

    return named.length > 0 && named.length < skills.length ? [{ named, word }] : [];
  });

  return {
    skillIds: new Set(words.flatMap((entry) => entry.named.map((skill) => skill.skillId))),
    words: words.map((entry) => entry.word),
  };
}

const MAX_NAME_WORDS = 4;

function toPartName({ language, words }: { language: string; words: readonly string[] }): string {
  const list = new Intl.ListFormat(language, { type: "conjunction" });
  const name = list.format(words.slice(0, MAX_NAME_WORDS));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The plan-edit model sometimes reads a focus on some topics as the whole area, which in a one-area
 * plan changes nothing.
 */
export function withTopicPart({
  context,
  operation,
  request,
}: {
  context: PlanContext;
  operation: FocusOperation;
  request: string;
}): FocusOperation {
  const { graph } = context.state;
  const areas = new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })));
  const [area] = operation.areas;

  if (areas.size !== 1 || !area || !areas.has(area) || (operation.parts ?? []).length > 0) {
    return operation;
  }

  const { skillIds, words } = findTopicWords({ request, skills: listSkillStems(context) });

  if (skillIds.size === 0) {
    return operation;
  }

  return {
    ...operation,
    parts: [
      {
        area,
        name: toPartName({ language: context.goal.language, words }),
        skillIds: [...skillIds],
      },
    ],
  };
}
