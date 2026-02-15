"use client";

import {
  type DiagramVisualContent,
  diagramVisualContentSchema,
} from "@zoonk/core/steps/visual-content-contract";
import { useExtracted } from "next-intl";
import { useId, useMemo } from "react";
import {
  type DiagramLayout,
  type PositionedEdge,
  type PositionedNode,
  computeDiagramLayout,
} from "./diagram-layout";

const NODE_BORDER_RADIUS = 8;
const EDGE_STROKE_WIDTH = 1.5;
const EDGE_OPACITY = 0.25;
const ARROW_SIZE = 8;
const EDGE_LABEL_CHAR_WIDTH = 6;
const EDGE_LABEL_PADDING_X = 6;
const EDGE_LABEL_PADDING_Y = 3;
const EDGE_LABEL_FONT_SIZE = 11;

function ArrowMarker({ markerId }: { markerId: string }) {
  return (
    <defs>
      <marker
        id={markerId}
        markerHeight={ARROW_SIZE}
        markerUnits="strokeWidth"
        markerWidth={ARROW_SIZE}
        orient="auto-start-reverse"
        refX={ARROW_SIZE}
        refY={ARROW_SIZE / 2}
        viewBox={`0 0 ${ARROW_SIZE} ${ARROW_SIZE}`}
      >
        <path
          d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`}
          fill="currentColor"
          opacity={EDGE_OPACITY}
        />
      </marker>
    </defs>
  );
}

function DiagramEdgeLine({ edge, markerId }: { edge: PositionedEdge; markerId: string }) {
  const pathData = edge.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <path
      d={pathData}
      fill="none"
      markerEnd={`url(#${markerId})`}
      opacity={EDGE_OPACITY}
      stroke="currentColor"
      strokeWidth={EDGE_STROKE_WIDTH}
    />
  );
}

function DiagramEdgeLabel({ edge }: { edge: PositionedEdge }) {
  if (!edge.label) {
    return null;
  }

  const midIndex = Math.floor(edge.points.length / 2);
  const midPoint = edge.points[midIndex];

  if (!midPoint) {
    return null;
  }

  const labelWidth = edge.label.length * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_PADDING_X * 2;
  const labelHeight = EDGE_LABEL_FONT_SIZE + EDGE_LABEL_PADDING_Y * 2;

  return (
    <g>
      <rect
        fill="var(--background)"
        height={labelHeight}
        rx={4}
        width={labelWidth}
        x={midPoint.x - labelWidth / 2}
        y={midPoint.y - labelHeight / 2}
      />

      <text
        dominantBaseline="central"
        fill="var(--muted-foreground)"
        fontSize={EDGE_LABEL_FONT_SIZE}
        textAnchor="middle"
        x={midPoint.x}
        y={midPoint.y}
      >
        {edge.label}
      </text>
    </g>
  );
}

function DiagramEdges({ edges, markerId }: { edges: PositionedEdge[]; markerId: string }) {
  return (
    <g>
      {edges.map((edge) => (
        <g key={`${edge.source}-${edge.target}`}>
          <DiagramEdgeLine edge={edge} markerId={markerId} />
          <DiagramEdgeLabel edge={edge} />
        </g>
      ))}
    </g>
  );
}

function DiagramNodeRect({ node }: { node: PositionedNode }) {
  return (
    <g>
      <rect
        fill="var(--background)"
        height={node.height}
        rx={NODE_BORDER_RADIUS}
        ry={NODE_BORDER_RADIUS}
        stroke="var(--foreground)"
        strokeOpacity={0.15}
        strokeWidth={1}
        width={node.width}
        x={node.x - node.width / 2}
        y={node.y - node.height / 2}
      />

      <text
        dominantBaseline="central"
        fill="currentColor"
        fontSize={14}
        fontWeight={500}
        textAnchor="middle"
        x={node.x}
        y={node.y}
      >
        {node.label}
      </text>
    </g>
  );
}

function DiagramNodes({ nodes }: { nodes: PositionedNode[] }) {
  return (
    <g>
      {nodes.map((node) => (
        <DiagramNodeRect key={node.id} node={node} />
      ))}
    </g>
  );
}

function buildAccessibleDescription(content: DiagramVisualContent): string {
  const relationships = content.edges.map((edge) => {
    const sourceNode = content.nodes.find((node) => node.id === edge.source);
    const targetNode = content.nodes.find((node) => node.id === edge.target);
    const sourceName = sourceNode?.label ?? edge.source;
    const targetName = targetNode?.label ?? edge.target;
    const via = edge.label ? ` (${edge.label})` : "";

    return `${sourceName} connects to ${targetName}${via}`;
  });

  return relationships.join(". ");
}

function DiagramSvg({ layout, markerId }: { layout: DiagramLayout; markerId: string }) {
  return (
    <svg
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
    >
      <ArrowMarker markerId={markerId} />
      <DiagramEdges edges={layout.edges} markerId={markerId} />
      <DiagramNodes nodes={layout.nodes} />
    </svg>
  );
}

export function DiagramVisual({ content }: { content: unknown }) {
  const t = useExtracted();
  const markerId = useId();
  const parsed = diagramVisualContentSchema.parse(content);

  const layout = useMemo(
    () => computeDiagramLayout(parsed.nodes, parsed.edges),
    [parsed.nodes, parsed.edges],
  );

  const description = useMemo(() => buildAccessibleDescription(parsed), [parsed]);

  return (
    <figure aria-label={t("Diagram")} className="w-full max-w-xl">
      <DiagramSvg layout={layout} markerId={markerId} />
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}
