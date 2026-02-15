import { describe, expect, it } from "vitest";
import { computeDiagramLayout } from "./diagram-layout";

describe(computeDiagramLayout, () => {
  it("positions a linear chain with vertical ordering", () => {
    const nodes = [
      { id: "a", label: "Start" },
      { id: "b", label: "Middle" },
      { id: "c", label: "End" },
    ];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];

    const layout = computeDiagramLayout(nodes, edges);

    const nodeA = layout.nodes.find((node) => node.id === "a");
    const nodeB = layout.nodes.find((node) => node.id === "b");
    const nodeC = layout.nodes.find((node) => node.id === "c");

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(nodeC).toBeDefined();
    expect(nodeA!.y).toBeLessThan(nodeB!.y);
    expect(nodeB!.y).toBeLessThan(nodeC!.y);
  });

  it("positions a tree with root above children at the same level", () => {
    const nodes = [
      { id: "root", label: "Root" },
      { id: "left", label: "Left Child" },
      { id: "right", label: "Right Child" },
    ];
    const edges = [
      { source: "root", target: "left" },
      { source: "root", target: "right" },
    ];

    const layout = computeDiagramLayout(nodes, edges);

    const root = layout.nodes.find((node) => node.id === "root");
    const left = layout.nodes.find((node) => node.id === "left");
    const right = layout.nodes.find((node) => node.id === "right");

    expect(root!.y).toBeLessThan(left!.y);
    expect(left!.y).toBe(right!.y);

    // Children should not overlap horizontally
    const gap = Math.abs(left!.x - right!.x) - (left!.width + right!.width) / 2;
    expect(gap).toBeGreaterThanOrEqual(0);
  });

  it("handles a diamond shape with correct layer assignment", () => {
    const nodes = [
      { id: "top", label: "Top" },
      { id: "left", label: "Left" },
      { id: "right", label: "Right" },
      { id: "bottom", label: "Bottom" },
    ];
    const edges = [
      { source: "top", target: "left" },
      { source: "top", target: "right" },
      { source: "left", target: "bottom" },
      { source: "right", target: "bottom" },
    ];

    const layout = computeDiagramLayout(nodes, edges);

    const top = layout.nodes.find((node) => node.id === "top");
    const left = layout.nodes.find((node) => node.id === "left");
    const right = layout.nodes.find((node) => node.id === "right");
    const bottom = layout.nodes.find((node) => node.id === "bottom");

    expect(top!.y).toBeLessThan(left!.y);
    expect(left!.y).toBe(right!.y);
    expect(left!.y).toBeLessThan(bottom!.y);
  });

  it("handles a single node with no edges", () => {
    const layout = computeDiagramLayout([{ id: "solo", label: "Alone" }], []);

    expect(layout.nodes).toHaveLength(1);
    expect(layout.edges).toHaveLength(0);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it("preserves edge labels in output", () => {
    const nodes = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const edges = [{ label: "connects to", source: "a", target: "b" }];

    const layout = computeDiagramLayout(nodes, edges);
    const [edge] = layout.edges;

    expect(edge).toBeDefined();
    expect(edge!.label).toBe("connects to");
    expect(edge!.source).toBe("a");
    expect(edge!.target).toBe("b");
    expect(edge!.points.length).toBeGreaterThan(0);
  });

  it("scales node width with label length", () => {
    const shortLabel = "Hi";
    const longLabel = "This is a significantly longer label";
    const nodes = [
      { id: "short", label: shortLabel },
      { id: "long", label: longLabel },
    ];

    const layout = computeDiagramLayout(nodes, []);
    const shortNode = layout.nodes.find((node) => node.id === "short");
    const longNode = layout.nodes.find((node) => node.id === "long");

    expect(longNode!.width).toBeGreaterThan(shortNode!.width);
  });

  it("enforces a minimum node width", () => {
    const layout = computeDiagramLayout([{ id: "tiny", label: "X" }], []);
    const [node] = layout.nodes;

    expect(node).toBeDefined();
    expect(node!.width).toBeGreaterThanOrEqual(100);
  });

  it("returns layout dimensions that encompass all nodes", () => {
    const nodes = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" },
    ];
    const edges = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
    ];

    const layout = computeDiagramLayout(nodes, edges);

    for (const node of layout.nodes) {
      expect(node.x + node.width / 2).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height / 2).toBeLessThanOrEqual(layout.height);
    }
  });

  it("handles edges without labels", () => {
    const nodes = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const edges = [{ source: "a", target: "b" }];

    const layout = computeDiagramLayout(nodes, edges);
    const [edge] = layout.edges;

    expect(edge).toBeDefined();
    expect(edge!.label).toBeUndefined();
  });
});
