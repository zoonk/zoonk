import { type EdgeLabel, Graph, type GraphLabel, type NodeLabel, layout } from "@dagrejs/dagre";

export type PositionedNode = {
  height: number;
  id: string;
  label: string;
  width: number;
  x: number;
  y: number;
};

export type PositionedEdge = {
  label?: string;
  points: { x: number; y: number }[];
  source: string;
  target: string;
};

export type DiagramLayout = {
  edges: PositionedEdge[];
  height: number;
  nodes: PositionedNode[];
  width: number;
};

const MIN_NODE_WIDTH = 100;
const NODE_HEIGHT = 40;
const CHAR_WIDTH = 7.5;
const NODE_PADDING = 32;
const NODE_SEP = 60;
const RANK_SEP = 60;
const LAYOUT_PADDING = 40;
const LAYOUT_OFFSET = LAYOUT_PADDING / 2;

function estimateNodeWidth(label: string): number {
  return Math.max(MIN_NODE_WIDTH, label.length * CHAR_WIDTH + NODE_PADDING);
}

function readNodePosition(
  graph: Graph<GraphLabel, NodeLabel, EdgeLabel>,
  id: string,
): { height: number; width: number; x: number; y: number } {
  const node = graph.node(id);

  return {
    height: Number(node.height),
    width: Number(node.width),
    x: Number(node.x),
    y: Number(node.y),
  };
}

function readEdgePoints(
  graph: Graph<GraphLabel, NodeLabel, EdgeLabel>,
  source: string,
  target: string,
): { x: number; y: number }[] {
  const edge = graph.edge(source, target);
  return edge.points ?? [];
}

function readGraphDimensions(graph: Graph<GraphLabel, NodeLabel, EdgeLabel>): {
  height: number;
  width: number;
} {
  const info = graph.graph();
  return { height: Number(info.height ?? 0), width: Number(info.width ?? 0) };
}

export function computeDiagramLayout(
  nodes: {
    id: string;
    label: string;
  }[],
  edges: {
    label?: string;
    source: string;
    target: string;
  }[],
): DiagramLayout {
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>();

  graph.setGraph({ nodesep: NODE_SEP, rankdir: "TB", ranksep: RANK_SEP });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, {
      height: NODE_HEIGHT,
      label: node.label,
      width: estimateNodeWidth(node.label),
    });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target, { label: edge.label });
  }

  layout(graph);

  const positionedNodes = nodes.map((node) => ({
    ...translateNode(readNodePosition(graph, node.id)),
    id: node.id,
    label: node.label,
  }));

  const positionedEdges = edges.map((edge) => ({
    label: edge.label,
    points: translatePoints(readEdgePoints(graph, edge.source, edge.target)),
    source: edge.source,
    target: edge.target,
  }));

  const dimensions = readGraphDimensions(graph);

  return {
    edges: positionedEdges,
    height: dimensions.height + LAYOUT_PADDING,
    nodes: positionedNodes,
    width: dimensions.width + LAYOUT_PADDING,
  };
}

function translateNode(node: { height: number; width: number; x: number; y: number }) {
  return {
    ...node,
    x: node.x + LAYOUT_OFFSET,
    y: node.y + LAYOUT_OFFSET,
  };
}

function translatePoints(points: { x: number; y: number }[]) {
  return points.map((point) => ({
    x: point.x + LAYOUT_OFFSET,
    y: point.y + LAYOUT_OFFSET,
  }));
}
