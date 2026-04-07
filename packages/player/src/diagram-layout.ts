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
const NODE_FONT_WEIGHT = 500;
const NODE_FONT = `${NODE_FONT_WEIGHT} ${NODE_FONT_SIZE}px Inter, system-ui, sans-serif`;
const EDGE_FONT = `${EDGE_LABEL_FONT_SIZE}px Inter, system-ui, sans-serif`;

/**
 * Cached OffscreenCanvas context for text measurement.
 * `undefined` = not yet initialized, `null` = unavailable
 * (e.g. test environments without canvas support).
 */
let canvasCtx: OffscreenCanvasRenderingContext2D | null | undefined;

function getCanvasContext(): OffscreenCanvasRenderingContext2D | null {
  if (canvasCtx !== undefined) {
    return canvasCtx;
  }

  if (typeof OffscreenCanvas === "undefined") {
    canvasCtx = null;
    return null;
  }

  const canvas = new OffscreenCanvas(1, 1);
  canvasCtx = canvas.getContext("2d");
  return canvasCtx;
}

/**
 * Measures text width using OffscreenCanvas when available (browser),
 * falling back to a character-count heuristic in environments without
 * canvas support (e.g. jsdom in tests). Using actual measurement
 * produces accurate node sizing for proportional fonts, mixed-width
 * characters, and non-Latin scripts.
 */
function measureText(text: string, font: string, fontSize: number): number {
  const ctx = getCanvasContext();

  if (ctx) {
    ctx.font = font;
    return ctx.measureText(text).width;
  }

  // Fallback: average character width for proportional
  // sans-serif fonts like Inter is ~55% of the font size.
  const averageCharWidthRatio = 0.55;
  return text.length * fontSize * averageCharWidthRatio;
}

function measureNodeWidth(label: string): number {
  return Math.max(MIN_NODE_WIDTH, measureText(label, NODE_FONT, NODE_FONT_SIZE) + NODE_PADDING);
}

function measureEdgeLabelWidth(label: string): number {
  return measureText(label, EDGE_FONT, EDGE_LABEL_FONT_SIZE) + EDGE_LABEL_PADDING_X * 2;
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
      width: measureNodeWidth(node.label),
    });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target, {
      height: edge.label ? EDGE_LABEL_HEIGHT : 0,
      label: edge.label,
      width: edge.label ? measureEdgeLabelWidth(edge.label) : 0,
    });
  }

  layout(graph);

  const positionedNodes = nodes.map((node) => ({
    ...readNodePosition(graph, node.id),
    id: node.id,
    label: node.label,
  }));

  const positionedEdges = edges.map((edge) => {
    const edgeData = readEdge(graph, edge.source, edge.target);

    return {
      label: edge.label,
      labelHeight: edge.label ? EDGE_LABEL_HEIGHT : undefined,
      labelWidth: edge.label ? measureEdgeLabelWidth(edge.label) : undefined,
      labelX: edgeData.labelX,
      labelY: edgeData.labelY,
      points: edgeData.points,
      source: edge.source,
      target: edge.target,
    };
  });

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
