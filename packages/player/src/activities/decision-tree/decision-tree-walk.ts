import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";

type TreeFields = ActivityContentFor<"decisionTree">["fields"];
export type TreeNode = TreeFields["nodes"][number];
type QuestionNode = Extract<TreeNode, { kind: "question" }>;

type WalkStep = { branch: string; node: QuestionNode };

export function findNode(nodes: readonly TreeNode[], id: string | undefined): TreeNode | null {
  return nodes.find((node) => node.id === id) ?? null;
}

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
