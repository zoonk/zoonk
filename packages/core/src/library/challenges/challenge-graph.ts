import {
  type ChallengeChoice,
  type ChallengeContent,
  type ChallengeEnding,
  type ChallengeNode,
} from "../steps/contract/challenge-content";

const CHALLENGE_DECISIONS = { max: 4, min: 2 } as const;

type ChallengeGraphIssue = { message: string; path: (number | string)[] };

export const CHALLENGE_NAME_PATTERN = /\{\{(?<slotId>[\w-]+)\}\}/gu;

export type ChallengeStep = { choice: ChallengeChoice; node: ChallengeNode };

export type ChallengeWalk =
  | { node: ChallengeNode; status: "deciding"; steps: ChallengeStep[] }
  | { ending: ChallengeEnding; status: "ended"; steps: ChallengeStep[] }
  | { status: "invalid" };

function findNode(content: ChallengeContent, id: string): ChallengeNode | undefined {
  return content.nodes.find((node) => node.id === id);
}

function findEnding(content: ChallengeContent, id: string): ChallengeEnding | undefined {
  return content.endings.find((ending) => ending.id === id);
}

export function walkChallenge(
  content: ChallengeContent,
  choiceIds: readonly string[],
): ChallengeWalk {
  const walk = (
    nodeId: string,
    remaining: readonly string[],
    steps: ChallengeStep[],
  ): ChallengeWalk => {
    const node = findNode(content, nodeId);
    const ending = node ? undefined : findEnding(content, nodeId);

    if (ending) {
      return remaining.length === 0 ? { ending, status: "ended", steps } : { status: "invalid" };
    }

    if (!node) {
      return { status: "invalid" };
    }

    const [choiceId, ...rest] = remaining;

    if (choiceId === undefined) {
      return { node, status: "deciding", steps };
    }

    const choice = node.choices.find((item) => item.id === choiceId);

    return choice ? walk(choice.next, rest, [...steps, { choice, node }]) : { status: "invalid" };
  };

  return walk(content.startNodeId, choiceIds, []);
}

type PathSearch = { cycle: boolean; lengths: number[]; reached: Set<string> };

function explorePaths(content: ChallengeContent): PathSearch {
  const search: PathSearch = { cycle: false, lengths: [], reached: new Set() };

  const visit = (id: string, trail: readonly string[]) => {
    search.reached.add(id);
    const node = findNode(content, id);

    if (!node || trail.length > CHALLENGE_DECISIONS.max) {
      search.lengths.push(trail.length);
      return;
    }

    if (trail.includes(id)) {
      search.cycle = true;
      return;
    }

    node.choices.forEach((choice) => visit(choice.next, [...trail, id]));
  };

  visit(content.startNodeId, []);
  return search;
}

function referenceIssues(content: ChallengeContent): ChallengeGraphIssue[] {
  const targets = new Set([...content.nodes, ...content.endings].map((item) => item.id));
  const team = new Set(content.team.map((slot) => slot.id));
  const meters = new Set(content.meters.map((meter) => meter.id));
  const skills = new Set(content.skills.map((skill) => skill.id));

  return content.nodes.flatMap((node, nodeIndex) => {
    const path = ["nodes", nodeIndex];

    const messages = node.messages
      .filter((message) => !team.has(message.from))
      .map((message) => ({
        message: `A message is from "${message.from}", who isn't on the team`,
        path,
      }));

    const choices = node.choices.flatMap((choice) => [
      ...(targets.has(choice.next)
        ? []
        : [
            {
              message: `Choice "${choice.id}" leads to "${choice.next}", which doesn't exist`,
              path,
            },
          ]),
      ...choice.replies
        .filter((reply) => !team.has(reply.from))
        .map((reply) => ({
          message: `A reply is from "${reply.from}", who isn't on the team`,
          path,
        })),
      ...choice.effects
        .filter((effect) => !meters.has(effect.meter))
        .map((effect) => ({
          message: `Choice "${choice.id}" moves unknown meter "${effect.meter}"`,
          path,
        })),
      ...choice.notes
        .filter((note) => !skills.has(note.skill))
        .map((note) => ({ message: `A note trains unknown skill "${note.skill}"`, path })),
    ]);

    return [...messages, ...choices];
  });
}

function decisionIssues(content: ChallengeContent): ChallengeGraphIssue[] {
  return content.nodes.flatMap((node, nodeIndex) => {
    const strong = node.choices.filter((choice) => choice.quality === "strong").length;

    return strong === 0 || strong === node.choices.length
      ? [
          {
            message: `Decision "${node.id}" needs a strong choice and at least one that isn't`,
            path: ["nodes", nodeIndex, "choices"],
          },
        ]
      : [];
  });
}

function shapeIssues(content: ChallengeContent): ChallengeGraphIssue[] {
  const nodeIds = new Set(content.nodes.map((node) => node.id));

  const notedSkills = new Set(
    content.nodes.flatMap((node) =>
      node.choices.flatMap((choice) => choice.notes.map((note) => note.skill)),
    ),
  );

  const slotIds = new Set(content.team.map((slot) => slot.id));

  const unknownNames = [...JSON.stringify(content).matchAll(CHALLENGE_NAME_PATTERN)]
    .map((match) => match.groups?.slotId ?? "")
    .filter((slotId) => !slotIds.has(slotId));

  return [
    !nodeIds.has(content.startNodeId) && {
      message: "The case must start with a decision",
      path: ["startNodeId"],
    },
    content.endings.some((ending) => nodeIds.has(ending.id)) && {
      message: "An ending has the same id as a decision",
      path: ["endings"],
    },
    content.team.filter((slot) => slot.ai).length > 1 && {
      message: "At most one colleague is an AI assistant",
      path: ["team"],
    },
    ...[...new Set(unknownNames)].map((slotId) => ({
      message: `"{{${slotId}}}" names someone who isn't on the team`,
      path: ["team"],
    })),
    ...content.skills
      .filter((skill) => !notedSkills.has(skill.id))
      .map((skill) => ({ message: `No decision trains skill "${skill.id}"`, path: ["skills"] })),
  ].filter((item) => item !== false);
}

function pathIssues(content: ChallengeContent): ChallengeGraphIssue[] {
  if (!content.nodes.some((node) => node.id === content.startNodeId)) {
    return [];
  }

  const search = explorePaths(content);

  const unreached = [...content.nodes, ...content.endings].filter(
    (item) => !search.reached.has(item.id),
  );

  const { max, min } = CHALLENGE_DECISIONS;

  return [
    search.cycle && { message: "A path loops back to an earlier decision", path: ["nodes"] },
    search.lengths.some((length) => length < min || length > max) && {
      message: `Every path must end after ${min} to ${max} decisions`,
      path: ["nodes"],
    },
    ...unreached.map((item) => ({
      message: `"${item.id}" can't be reached from the start`,
      path: ["nodes"],
    })),
  ].filter((item) => item !== false);
}

export function getChallengeGraphIssues(content: ChallengeContent): ChallengeGraphIssue[] {
  return [
    ...shapeIssues(content),
    ...referenceIssues(content),
    ...decisionIssues(content),
    ...pathIssues(content),
  ];
}
