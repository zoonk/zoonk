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
  width: number;
};

const MIN_NODE_WIDTH = 100;
const NODE_HEIGHT = 40;
const CHAR_WIDTH = 7.5;
const NODE_PADDING = 32;
const NODE_SEP = 60;
const RANK_SEP = 60;
const LAYOUT_PADDING = 40;
const EDGE_LABEL_CHAR_WIDTH = 7;
const EDGE_LABEL_PADDING_X = 6;
const EDGE_LABEL_FONT_SIZE = 11;
const EDGE_LABEL_PADDING_Y = 3;
const EDGE_LABEL_HEIGHT = EDGE_LABEL_FONT_SIZE + EDGE_LABEL_PADDING_Y * 2;

function estimateNodeWidth(label: string): number {
  return Math.max(MIN_NODE_WIDTH, label.length * CHAR_WIDTH + NODE_PADDING);
}

function estimateEdgeLabelWidth(label: string): number {
  return label.length * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_PADDING_X * 2;
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
 * Computes the actual bounding box of all positioned elements —
 * nodes and edge points — then returns dimensions and an offset
 * that ensures nothing is clipped by the SVG viewBox.
 *
 * Dagre's `graph.graph()` dimensions can undercount because
 * back-edges in cycles produce control points outside the
 * reported bounds. Computing from actual positions avoids this.
 *
 * Edge labels don't need special handling here because dagre
 * already accounts for their dimensions when we pass `width`
 * and `height` in `setEdge`.
 */
function computeBounds({ edges, nodes }: { edges: PositionedEdge[]; nodes: PositionedNode[] }): {
  height: number;
  offsetX: number;
  offsetY: number;
  width: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const left = node.x - node.width / 2;
    const right = node.x + node.width / 2;
    const top = node.y - node.height / 2;
    const bottom = node.y + node.height / 2;

    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, bottom);
  }

  for (const edge of edges) {
    for (const point of edge.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    if (edge.labelX !== undefined && edge.labelWidth) {
      const halfWidth = edge.labelWidth / 2;
      minX = Math.min(minX, edge.labelX - halfWidth);
      maxX = Math.max(maxX, edge.labelX + halfWidth);
    }

    if (edge.labelY !== undefined && edge.labelHeight) {
      const halfHeight = edge.labelHeight / 2;
      minY = Math.min(minY, edge.labelY - halfHeight);
      maxY = Math.max(maxY, edge.labelY + halfHeight);
    }
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  return {
    height: contentHeight + LAYOUT_PADDING,
    offsetX: -minX + LAYOUT_PADDING / 2,
    offsetY: -minY + LAYOUT_PADDING / 2,
    width: contentWidth + LAYOUT_PADDING,
  };
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
    graph.setEdge(edge.source, edge.target, {
      height: edge.label ? EDGE_LABEL_HEIGHT : 0,
      label: edge.label,
      width: edge.label ? estimateEdgeLabelWidth(edge.label) : 0,
    });
  }

  layout(graph);

  const rawNodes = nodes.map((node) => ({
    ...readNodePosition(graph, node.id),
    id: node.id,
    label: node.label,
  }));

  const rawEdges = edges.map((edge) => {
    const edgeData = readEdge(graph, edge.source, edge.target);
    const labelWidth = edge.label ? estimateEdgeLabelWidth(edge.label) : undefined;
    const labelHeight = edge.label ? EDGE_LABEL_HEIGHT : undefined;

    return {
      label: edge.label,
      labelHeight,
      labelWidth,
      labelX: edgeData.labelX,
      labelY: edgeData.labelY,
      points: edgeData.points,
      source: edge.source,
      target: edge.target,
    };
  });

  const bounds = computeBounds({ edges: rawEdges, nodes: rawNodes });

  const positionedNodes = rawNodes.map((node) => ({
    ...node,
    x: node.x + bounds.offsetX,
    y: node.y + bounds.offsetY,
  }));

  const positionedEdges = rawEdges.map((edge) => ({
    ...edge,
    labelX: edge.labelX === undefined ? undefined : edge.labelX + bounds.offsetX,
    labelY: edge.labelY === undefined ? undefined : edge.labelY + bounds.offsetY,
    points: edge.points.map((point) => ({
      x: point.x + bounds.offsetX,
      y: point.y + bounds.offsetY,
    })),
  }));

  return {
    edges: positionedEdges,
    height: bounds.height,
    nodes: positionedNodes,
    width: bounds.width,
  };
}
