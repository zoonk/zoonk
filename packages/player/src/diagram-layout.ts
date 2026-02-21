import dagre from "@dagrejs/dagre";

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

function estimateNodeWidth(label: string): number {
  return Math.max(MIN_NODE_WIDTH, label.length * CHAR_WIDTH + NODE_PADDING);
}

/* oxlint-disable no-unsafe-member-access -- dagre node properties are untyped after layout */
function readNodePosition(
  graph: dagre.graphlib.Graph,
  id: string,
): { height: number; width: number; x: number; y: number } {
  // oxlint-disable-next-line no-unsafe-assignment -- dagre layout mutates nodes in place
  const node = graph.node(id);

  return {
    height: Number(node.height),
    width: Number(node.width),
    x: Number(node.x),
    y: Number(node.y),
  };
}
/* oxlint-enable no-unsafe-member-access */

function readEdgePoints(
  graph: dagre.graphlib.Graph,
  source: string,
  target: string,
): { x: number; y: number }[] {
  // oxlint-disable-next-line no-unsafe-assignment -- dagre edge data is untyped after layout
  const edge = graph.edge(source, target);
  // oxlint-disable-next-line no-unsafe-member-access, no-unsafe-type-assertion -- dagre edge points array is untyped
  return (edge.points ?? []) as { x: number; y: number }[];
}

function readGraphDimensions(graph: dagre.graphlib.Graph): { height: number; width: number } {
  // oxlint-disable-next-line no-unsafe-assignment -- dagre graph dimensions are untyped
  const info = graph.graph();
  // oxlint-disable-next-line no-unsafe-member-access -- dagre graph info properties are untyped
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
  const graph = new dagre.graphlib.Graph();

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

  dagre.layout(graph);

  const positionedNodes = nodes.map((node) => ({
    ...readNodePosition(graph, node.id),
    id: node.id,
    label: node.label,
  }));

  const positionedEdges = edges.map((edge) => ({
    label: edge.label,
    points: readEdgePoints(graph, edge.source, edge.target),
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
