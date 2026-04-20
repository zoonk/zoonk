import { describe, expect, test } from "vitest";
import { buildVisualDiagramOutput } from "./diagram-output";

describe(buildVisualDiagramOutput, () => {
  test("resolves edge labels to node ids and removes orphan nodes", () => {
    expect(
      buildVisualDiagramOutput({
        edges: [
          { from: "input", label: "starts", to: "processor" },
          { from: "processor", label: "ends", to: "Final Output" },
        ],
        nodes: [
          { label: "Input" },
          { label: "Processor" },
          { label: "Final Output" },
          { label: "Unused Node" },
        ],
      }),
    ).toEqual({
      edges: [
        { label: "starts", source: "input", target: "processor" },
        { label: "ends", source: "processor", target: "final-output" },
      ],
      nodes: [
        { id: "input", label: "Input" },
        { id: "processor", label: "Processor" },
        { id: "final-output", label: "Final Output" },
      ],
    });
  });

  test("falls back to a slug when an edge label has no matching node", () => {
    expect(
      buildVisualDiagramOutput({
        edges: [{ from: "Unknown State", label: null, to: "Known State" }],
        nodes: [{ label: "Known State" }],
      }),
    ).toEqual({
      edges: [{ label: null, source: "unknown-state", target: "known-state" }],
      nodes: [{ id: "known-state", label: "Known State" }],
    });
  });

  test("matches labels when the edge adds leading or trailing words", () => {
    expect(
      buildVisualDiagramOutput({
        edges: [{ from: "Input Node", label: null, to: "Processor Stage" }],
        nodes: [{ label: "Input" }, { label: "Processor" }],
      }),
    ).toEqual({
      edges: [{ label: null, source: "input", target: "processor" }],
      nodes: [
        { id: "input", label: "Input" },
        { id: "processor", label: "Processor" },
      ],
    });
  });

  test("creates a non-empty id for punctuation-only node labels", () => {
    expect(
      buildVisualDiagramOutput({
        edges: [
          { from: "print", label: "chama a ação", to: "( )" },
          { from: "( )", label: "envolve o argumento", to: '"Olá"' },
        ],
        nodes: [{ label: "print" }, { label: "( )" }, { label: '"Olá"' }],
      }),
    ).toEqual({
      edges: [
        { label: "chama a ação", source: "print", target: "diagram-node-2" },
        { label: "envolve o argumento", source: "diagram-node-2", target: "ola" },
      ],
      nodes: [
        { id: "print", label: "print" },
        { id: "diagram-node-2", label: "( )" },
        { id: "ola", label: '"Olá"' },
      ],
    });
  });

  test("falls back to a non-empty id when an unmatched edge label slug is empty", () => {
    expect(
      buildVisualDiagramOutput({
        edges: [{ from: "( )", label: null, to: "Known State" }],
        nodes: [{ label: "Known State" }],
      }),
    ).toEqual({
      edges: [{ label: null, source: "unmatched-diagram-node", target: "known-state" }],
      nodes: [{ id: "known-state", label: "Known State" }],
    });
  });

  test("does not let unmatched fallback ids collide with real node ids", () => {
    expect(
      buildVisualDiagramOutput({
        edges: [{ from: "( )", label: null, to: "Known State" }],
        nodes: [{ label: "Known State" }, { label: "Unmatched Diagram Node" }],
      }),
    ).toEqual({
      edges: [{ label: null, source: "unmatched-diagram-node-2", target: "known-state" }],
      nodes: [{ id: "known-state", label: "Known State" }],
    });
  });
});
