import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  promptSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { issue } from "./_utils/template-helpers";

const MAX_BRANCHES = 4;
const MAX_NODES = 15;

const nodeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      branches: z
        .array(z.object({ label: labelSchema, next: idSchema }).strict())
        .min(2)
        .max(MAX_BRANCHES),
      id: idSchema,
      kind: z.literal("question"),
      question: promptSchema,
    })
    .strict(),
  z.object({ id: idSchema, kind: z.literal("outcome"), label: labelSchema }).strict(),
]);

const decisionTreeFields = z
  .object({
    case: z
      .object({
        answers: z
          .array(z.object({ branch: labelSchema, nodeId: idSchema }).strict())
          .min(1)
          .max(MAX_NODES),
        description: explanationSchema,
        outcomeId: idSchema,
      })
      .strict(),
    nodes: uniqueIdsSchema(nodeSchema, { max: MAX_NODES, min: 3 }),
    rootId: idSchema,
  })
  .strict();

type DecisionTreeFields = z.output<typeof decisionTreeFields>;
type TreeNode = z.output<typeof nodeSchema>;

function childIds(node: TreeNode): string[] {
  return node.kind === "question" ? node.branches.map((branch) => branch.next) : [];
}

/**
 * Walks the tree the way the case answers each question. Returns the node ids visited, ending at
 * an outcome, or null when an answer is missing or the walk loops.
 */
function walkCase(
  fields: DecisionTreeFields,
  path: readonly string[] = [fields.rootId],
): string[] | null {
  const currentId = path.at(-1);
  const node = fields.nodes.find((item) => item.id === currentId);

  if (!node || path.length > fields.nodes.length) {
    return null;
  }

  if (node.kind === "outcome") {
    return [...path];
  }

  const answer = fields.case.answers.find((item) => item.nodeId === node.id);
  const next = node.branches.find((branch) => branch.label === answer?.branch)?.next;

  return next ? walkCase(fields, [...path, next]) : null;
}

function reachable(fields: DecisionTreeFields, visited: ReadonlySet<string>): ReadonlySet<string> {
  const next = fields.nodes
    .filter((node) => visited.has(node.id))
    .flatMap((node) => childIds(node));

  const grown = new Set([...visited, ...next]);

  return grown.size === visited.size ? visited : reachable(fields, grown);
}

function treeShapeIssues(fields: DecisionTreeFields) {
  const ids = new Set(fields.nodes.map((node) => node.id));
  const children = fields.nodes.flatMap((node) => childIds(node));
  const root = fields.nodes.find((node) => node.id === fields.rootId);

  return [
    root?.kind !== "question" &&
      issue("inconsistentFields", "fields.rootId", "The tree must start with a question"),
    children.some((id) => !ids.has(id)) &&
      issue("inconsistentFields", "fields.nodes", "A branch leads to a node that doesn't exist"),
    (children.includes(fields.rootId) || new Set(children).size !== children.length) &&
      issue(
        "inconsistentFields",
        "fields.nodes",
        "Each node must have one way in, so the tree has no loops",
      ),
    reachable(fields, new Set([fields.rootId])).size !== fields.nodes.length &&
      issue("inconsistentFields", "fields.nodes", "Some nodes can't be reached from the start"),
  ].filter((item) => item !== false);
}

export const decisionTreeTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Walk a branching key one question at a time, like naming a tree from one leaf, to learn which features matter and in what order. Code walks the case's answers from the root and must reach the stated outcome. Fills: the questions and branches, the outcomes, and the case with its answer at each question. When seeing the case is how the key is used (a leaf, a rock, a bird), the screen's image is a picture of the case with the features the questions ask about, and its alt describes them without naming the outcome.",
  expected: (fields) => {
    const path = walkCase(fields);
    return path ? { ids: path, kind: "order" } : null;
  },
  fields: decisionTreeFields,
  id: "decisionTree",
  needsData: false,
  verify: (fields) => {
    const shapeIssues = treeShapeIssues(fields);

    if (shapeIssues.length > 0) {
      return shapeIssues;
    }

    return walkCase(fields)?.at(-1) === fields.case.outcomeId
      ? []
      : [issue("answerMismatch", "fields.case", "Walking the case doesn't reach its outcome")];
  },
});
