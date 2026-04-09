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
  labelX?: number;
  labelY?: number;
  labelWidth?: number;
  labelHeight?: number;
  points: { x: number; y: number }[];
  source: string;
  target: string;
};

export type DiagramLayout = {
  edges: PositionedEdge[];
  height: number;
  nodes: PositionedNode[];
  viewBox: string;
  width: number;
};

type DiagramNodeInput = {
  id: string;
  label: string;
};

type DiagramEdgeInput = {
  label?: string;
  source: string;
  target: string;
};

const MIN_NODE_WIDTH = 100;
const NODE_HEIGHT = 40;
const NODE_PADDING = 32;
const NODE_SEP = 60;
const RANK_SEP = 60;
const LAYOUT_PADDING = 40;
const EDGE_LABEL_PADDING_X = 6;
const EDGE_LABEL_FONT_SIZE = 11;
const EDGE_LABEL_PADDING_Y = 3;
const EDGE_LABEL_HEIGHT = EDGE_LABEL_FONT_SIZE + EDGE_LABEL_PADDING_Y * 2;

const NODE_FONT_SIZE = 14;

/**
 * Estimates text width without consulting browser-only APIs.
 *
 * The diagram layout is part of the prerendered HTML for a Client Component,
 * so server and client must compute the same numbers during hydration.
 * Using `OffscreenCanvas` in the browser but not on the server causes the SVG
 * geometry to diverge, which React correctly reports as a hydration mismatch.
 *
 * A small deterministic estimate is enough here because dagre only needs
 * stable relative widths to avoid overlaps; it does not require pixel-perfect
 * typography metrics.
 */
function estimateTextWidth({ fontSize, text }: { fontSize: number; text: string }): number {
  // Fallback: average character width for proportional
  // sans-serif fonts like Inter is ~55% of the font size.
  const averageCharWidthRatio = 0.55;
  return text.length * fontSize * averageCharWidthRatio;
}

function measureNodeWidth(label: string): number {
  return Math.max(
    MIN_NODE_WIDTH,
    estimateTextWidth({ fontSize: NODE_FONT_SIZE, text: label }) + NODE_PADDING,
  );
}

function measureEdgeLabelWidth(label: string): number {
  return (
    estimateTextWidth({ fontSize: EDGE_LABEL_FONT_SIZE, text: label }) + EDGE_LABEL_PADDING_X * 2
  );
}

/**
 * Precomputes node widths once so dagre layout and the rendered SVG use the
 * same dimensions. This avoids duplicated sizing logic drifting over time.
 */
function sizeNode(node: DiagramNodeInput): DiagramNodeInput & { width: number } {
  return {
    ...node,
    width: measureNodeWidth(node.label),
  };
}

/**
 * Precomputes edge label dimensions once so dagre reserves space for the same
 * label box that the SVG later renders.
 */
function sizeEdge(edge: DiagramEdgeInput): DiagramEdgeInput & {
  labelHeight?: number;
  labelWidth?: number;
} {
  return {
    ...edge,
    labelHeight: edge.label ? EDGE_LABEL_HEIGHT : undefined,
    labelWidth: edge.label ? measureEdgeLabelWidth(edge.label) : undefined,
  };
}

function readNodePosition(
  graph: Graph<GraphLabel, NodeLabel, EdgeLabel>,
  id: string,
): { height: number; width: number; x: number; y: number } {
  const node = graph.node(id);

  return {
    height: node.height,
    width: node.width,
    x: node.x ?? 0,
    y: node.y ?? 0,
  };
}

function readEdge(
  graph: Graph<GraphLabel, NodeLabel, EdgeLabel>,
  source: string,
  target: string,
): { labelX?: number; labelY?: number; points: { x: number; y: number }[] } {
  const edge = graph.edge(source, target);

  return {
    labelX: typeof edge.x === "number" ? edge.x : undefined,
    labelY: typeof edge.y === "number" ? edge.y : undefined,
    points: edge.points ?? [],
  };
}

/**
 * Computes an SVG viewBox that encompasses all positioned elements —
 * nodes, edge points, and edge labels — with padding.
 *
 * Instead of translating all coordinates to a (0,0) origin, we let
 * the SVG viewBox handle the coordinate mapping. This eliminates the
 * offset-translation step while correctly handling dagre's back-edge
 * control points that can fall outside its reported bounds.
 */
function computeViewBox({ edges, nodes }: { edges: PositionedEdge[]; nodes: PositionedNode[] }): {
  height: number;
  viewBox: string;
  width: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }

  for (const edge of edges) {
    for (const point of edge.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    if (edge.labelX !== undefined && edge.labelWidth) {
      minX = Math.min(minX, edge.labelX - edge.labelWidth / 2);
      maxX = Math.max(maxX, edge.labelX + edge.labelWidth / 2);
    }

    if (edge.labelY !== undefined && edge.labelHeight) {
      minY = Math.min(minY, edge.labelY - edge.labelHeight / 2);
      maxY = Math.max(maxY, edge.labelY + edge.labelHeight / 2);
    }
  }

  const padding = LAYOUT_PADDING / 2;
  const width = maxX - minX + LAYOUT_PADDING;
  const height = maxY - minY + LAYOUT_PADDING;

  return {
    height,
    viewBox: `${minX - padding} ${minY - padding} ${width} ${height}`,
    width,
  };
}

export function computeDiagramLayout(
  nodes: DiagramNodeInput[],
  edges: DiagramEdgeInput[],
): DiagramLayout {
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  const sizedNodes = nodes.map((node) => sizeNode(node));
  const sizedEdges = edges.map((edge) => sizeEdge(edge));

  graph.setGraph({ nodesep: NODE_SEP, rankdir: "TB", ranksep: RANK_SEP });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of sizedNodes) {
    graph.setNode(node.id, {
      height: NODE_HEIGHT,
      label: node.label,
      width: node.width,
    });
  }

  for (const edge of sizedEdges) {
    graph.setEdge(edge.source, edge.target, {
      height: edge.labelHeight ?? 0,
      label: edge.label,
      width: edge.labelWidth ?? 0,
    });
  }

  layout(graph);

  const positionedNodes = sizedNodes.map((node) => ({
    ...readNodePosition(graph, node.id),
    id: node.id,
    label: node.label,
  }));

  const positionedEdges = sizedEdges.map((edge) => ({
    ...edge,
    ...readEdge(graph, edge.source, edge.target),
  }));

  const { height, viewBox, width } = computeViewBox({
    edges: positionedEdges,
    nodes: positionedNodes,
  });

  return {
    edges: positionedEdges,
    height,
    nodes: positionedNodes,
    viewBox,
    width,
  };
}
