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

type SizedDiagramNode = DiagramNodeInput & {
  dagreId: string;
  width: number;
};

type SizedDiagramEdge = DiagramEdgeInput & {
  dagreSource: string;
  dagreTarget: string;
  labelHeight?: number;
  labelWidth?: number;
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
const EMPTY_DIAGRAM_NODE_PREFIX = "__diagram-empty-node__";

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
function sizeNode({ index, node }: { index: number; node: DiagramNodeInput }): SizedDiagramNode {
  return {
    dagreId: toDagreNodeId({ id: node.id, index }),
    ...node,
    width: measureNodeWidth(node.label),
  };
}

/**
 * Precomputes edge label dimensions once so dagre reserves space for the same
 * label box that the SVG later renders.
 */
function sizeEdge({
  edge,
  nodeIds,
}: {
  edge: DiagramEdgeInput;
  nodeIds: Map<string, string>;
}): SizedDiagramEdge {
  return {
    dagreSource: readDagreNodeId({ id: edge.source, nodeIds }),
    dagreTarget: readDagreNodeId({ id: edge.target, nodeIds }),
    ...edge,
    labelHeight: edge.label ? EDGE_LABEL_HEIGHT : undefined,
    labelWidth: edge.label ? measureEdgeLabelWidth(edge.label) : undefined,
  };
}

/**
 * Dagre crashes when a node id is the empty string, but our diagram contract
 * allows punctuation-only nodes such as `( )` to use that id. We keep the
 * external diagram ids unchanged and give dagre a safe internal id instead.
 */
function toDagreNodeId({ id, index }: { id: string; index: number }): string {
  if (id !== "") {
    return id;
  }

  return `${EMPTY_DIAGRAM_NODE_PREFIX}-${index}`;
}

/**
 * All edges need to target the same internal dagre ids that we assigned to
 * nodes above. Without this mapping, diagrams that contain empty-string ids can
 * still reach dagre's crash path during layout.
 */
function readDagreNodeId({ id, nodeIds }: { id: string; nodeIds: Map<string, string> }): string {
  const nodeId = nodeIds.get(id);

  if (nodeId !== undefined) {
    return nodeId;
  }

  return id === "" ? `${EMPTY_DIAGRAM_NODE_PREFIX}-missing` : id;
}

/**
 * The layout step should have a single source of truth for the ids that dagre
 * sees. Building the lookup from the sized nodes keeps node and edge
 * normalization in sync and avoids duplicating the empty-id rule.
 */
function buildDagreNodeIdMap(nodes: SizedDiagramNode[]): Map<string, string> {
  return new Map(nodes.map((node) => [node.id, node.dagreId]));
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
  const sizedNodes = nodes.map((node, index) => sizeNode({ index, node }));
  const dagreNodeIds = buildDagreNodeIdMap(sizedNodes);
  const sizedEdges = edges.map((edge) => sizeEdge({ edge, nodeIds: dagreNodeIds }));

  graph.setGraph({ nodesep: NODE_SEP, rankdir: "TB", ranksep: RANK_SEP });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of sizedNodes) {
    graph.setNode(node.dagreId, {
      height: NODE_HEIGHT,
      label: node.label,
      width: node.width,
    });
  }

  for (const edge of sizedEdges) {
    graph.setEdge(edge.dagreSource, edge.dagreTarget, {
      height: edge.labelHeight ?? 0,
      label: edge.label,
      width: edge.labelWidth ?? 0,
    });
  }

  layout(graph);

  const positionedNodes = sizedNodes.map((node) => ({
    ...readNodePosition(graph, node.dagreId),
    id: node.id,
    label: node.label,
  }));

  const positionedEdges = sizedEdges.map(({ dagreSource, dagreTarget, ...edge }) => ({
    ...edge,
    ...readEdge(graph, dagreSource, dagreTarget),
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
