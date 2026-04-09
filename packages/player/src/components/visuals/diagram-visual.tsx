"use client";

import { type DiagramVisualContent } from "@zoonk/core/steps/contract/visual";
import { useExtracted } from "next-intl";
import { useId, useMemo } from "react";
import {
  type DiagramLayout,
  type PositionedEdge,
  type PositionedNode,
  computeDiagramLayout,
} from "../../diagram-layout";

const NODE_BORDER_RADIUS = 8;
const EDGE_STROKE_WIDTH = 1.5;
const EDGE_OPACITY = 0.25;
const ARROW_SIZE = 8;
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

/**
 * Renders an edge label at the position computed by dagre.
 * Dagre places labels at non-overlapping coordinates because
 * we pass label `width` and `height` in `setEdge`, so it
 * treats labels as layout participants (not afterthoughts).
 */
function DiagramEdgeLabel({ edge }: { edge: PositionedEdge }) {
  if (!edge.label || edge.labelX === undefined || edge.labelY === undefined) {
    return null;
  }

  return (
    <g>
      {edge.labelWidth && edge.labelHeight ? (
        <rect
          fill="var(--background)"
          height={edge.labelHeight}
          rx={4}
          width={edge.labelWidth}
          x={edge.labelX - edge.labelWidth / 2}
          y={edge.labelY - edge.labelHeight / 2}
        />
      ) : null}

      <text
        dominantBaseline="central"
        fill="var(--muted-foreground)"
        fontSize={EDGE_LABEL_FONT_SIZE}
        textAnchor="middle"
        x={edge.labelX}
        y={edge.labelY}
      >
        {edge.label}
      </text>
    </g>
  );
}

function DiagramEdges({ edges, markerId }: { edges: PositionedEdge[]; markerId: string }) {
  return (
    <g>
      {edges.map((edge, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Multiple edges can share the same source-target pair, no unique ID on edges
        <g key={`${edge.source}-${edge.target}-${index}`}>
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
      className="block flex-none"
      height={layout.height}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      style={{ height: layout.height, width: layout.width }}
      viewBox={layout.viewBox}
      width={layout.width}
    >
      <ArrowMarker markerId={markerId} />
      <DiagramEdges edges={layout.edges} markerId={markerId} />
      <DiagramNodes nodes={layout.nodes} />
    </svg>
  );
}

export function DiagramVisual({ content }: { content: DiagramVisualContent }) {
  const t = useExtracted();
  const markerId = useId();
  const layout = useMemo(
    () => computeDiagramLayout(content.nodes, content.edges),
    [content.nodes, content.edges],
  );
  const description = buildAccessibleDescription(content);

  return (
    <figure aria-label={t("Diagram")} className="w-full max-w-full min-w-0">
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div className="flex w-max min-w-full justify-center">
          <DiagramSvg layout={layout} markerId={markerId} />
        </div>
      </div>

      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}
