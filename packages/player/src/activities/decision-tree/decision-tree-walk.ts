import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";

type TreeFields = ActivityContentFor<"decisionTree">["fields"];
export type TreeNode = TreeFields["nodes"][number];
type QuestionNode = Extract<TreeNode, { kind: "question" }>;

/** One answered question on a walk: the question and the branch taken. */
type WalkStep = { branch: string; node: QuestionNode };

export function findNode(nodes: readonly TreeNode[], id: string | undefined): TreeNode | null {
  return nodes.find((node) => node.id === id) ?? null;
}

/** Outcomes still reachable from a node: what's "still possible" after the answers so far. */
export function reachableOutcomes(nodes: readonly TreeNode[], id: string): TreeNode[] {
  const node = findNode(nodes, id);

  if (!node) {
    return [];
  }

  if (node.kind === "outcome") {
    return [node];
  }

  return node.branches.flatMap((branch) => reachableOutcomes(nodes, branch.next));
}

/** The questions answered along a path of node ids, with the branch that led to the next node. */
export function walkSteps(nodes: readonly TreeNode[], path: readonly string[]): WalkStep[] {
  return path.slice(0, -1).flatMap((id, index) => {
    const node = findNode(nodes, id);

    const branch =
      node?.kind === "question"
        ? node.branches.find((item) => item.next === path[index + 1])
        : undefined;

    return node?.kind === "question" && branch ? [{ branch: branch.label, node }] : [];
  });
}

/** Where a walk first left the expected path, as an index into the paths; null when it didn't. */
export function firstDivergence(
  expected: readonly string[],
  walked: readonly string[],
): number | null {
  const index = expected.findIndex((id, position) => walked[position] !== id);

  if (index !== -1) {
    return index;
  }

  return walked.length > expected.length ? expected.length : null;
}
