import { type VisualStepContent } from "@zoonk/core/steps/contract/visual";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

/**
 * Visual browser tests should exercise the shared player shell directly. This
 * keeps renderer coverage close to the package that owns the visual layout and
 * avoids booting the whole app just to verify one renderer branch.
 */
function renderVisualActivity({ steps }: { steps: ReturnType<typeof buildSerializedStep>[] }) {
  renderPlayer({
    activity: buildSerializedActivity({
      kind: "explanation",
      steps,
    }),
    viewer: buildAuthenticatedViewer(),
  });
}

/**
 * Most scenarios only care about one visual renderer branch. This helper keeps
 * the test data focused on the visual payload instead of repeated serialized
 * step boilerplate.
 */
function buildVisualStep({
  content,
  id = "visual-step",
  position = 0,
}: {
  content: VisualStepContent;
  id?: string;
  position?: number;
}) {
  return buildSerializedStep({
    content,
    id,
    kind: "visual",
    position,
  });
}

/**
 * Small diagrams should stay optically centered in the shared visual region.
 * Comparing the free space above and below the figure catches regressions where
 * the renderer collapses to the top of the stage.
 */
function getVerticalSpacing({
  container,
  item,
}: {
  container: ReturnType<typeof page.getByRole>;
  item: ReturnType<typeof page.getByRole>;
}) {
  const containerBox = container.element().getBoundingClientRect();
  const itemBox = item.element().getBoundingClientRect();

  return {
    bottom: containerBox.y + containerBox.height - (itemBox.y + itemBox.height),
    top: itemBox.y - containerBox.y,
  };
}

/**
 * Several layout tests only need a restore callback after conditionally sizing
 * the rendered player root. Using one shared no-op keeps those tests simple and
 * satisfies lint without recreating the same fallback function in each case.
 */
function restoreNothing() {}

/**
 * Browser tests mount the player inside a wrapper div created by Testing
 * Library. Constraining that wrapper is the smallest way to force narrow-stage
 * overflow and tall-stage centering without reaching for app-level viewport
 * controls that Vitest browser mode does not expose here.
 */
function setRenderRootSize({ height, width }: { height?: string; width?: string }): () => void {
  const root = document.body.firstElementChild;

  if (!(root instanceof HTMLElement)) {
    return restoreNothing;
  }

  const previous = {
    height: root.style.height,
    width: root.style.width,
  };

  if (width) {
    root.style.width = width;
  }

  if (height) {
    root.style.height = height;
  }

  return () => {
    root.style.width = previous.width;
    root.style.height = previous.height;
  };
}

describe("player browser integration: visual steps", () => {
  test("renders quote text and author", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            author: "Ada Lovelace",
            kind: "quote",
            text: "The analytical engine weaves algebraic patterns.",
          },
        }),
      ],
    });

    await expect.element(page.getByText(/analytical engine/i)).toBeInTheDocument();
    await expect.element(page.getByText(/ada lovelace/i)).toBeInTheDocument();
  });

  test("renders an image and falls back to the prompt when the URL is missing", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            kind: "image",
            prompt: "A bright sunset over the sea",
            url: "https://example.com/sunset.png",
          },
          id: "visual-image",
        }),
        buildVisualStep({
          content: {
            kind: "image",
            prompt: "Fallback mountain prompt",
          },
          id: "visual-image-fallback",
          position: 1,
        }),
      ],
    });

    await expect
      .element(page.getByRole("img", { name: /bright sunset over the sea/i }))
      .toBeInTheDocument();

    await page.getByRole("button", { name: /next step/i }).click();

    await expect.element(page.getByText(/fallback mountain prompt/i)).toBeInTheDocument();
  });

  test("renders code language labels and inline annotations", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            annotations: [{ line: 1, text: "This line declares the greeting." }],
            code: 'const greeting = "hello";\nconsole.log(greeting);',
            kind: "code",
            language: "javascript",
          },
        }),
      ],
    });

    const figure = page.getByRole("figure", { name: /javascript/i });

    await expect.element(figure).toBeInTheDocument();
    await expect.element(figure).toHaveTextContent("const greeting =");
    await expect
      .element(page.getByRole("note"))
      .toHaveTextContent("This line declares the greeting.");
  });

  test("renders table headers, cells, and caption", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            caption: "Language comparison",
            columns: ["Feature", "Python", "JavaScript"],
            kind: "table",
            rows: [
              ["Typing", "Dynamic", "Dynamic"],
              ["Paradigm", "Multi", "Multi"],
            ],
          },
        }),
      ],
    });

    await expect.element(page.getByRole("figure", { name: /language comparison/i })).toBeVisible();
    await expect.element(page.getByRole("columnheader", { name: "Feature" })).toBeVisible();
    await expect.element(page.getByRole("columnheader", { name: "Python" })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "Typing" })).toBeVisible();
    await expect.element(page.getByText("Language comparison")).toBeVisible();
  });

  test("keeps wide table overflow on the nested table container", async () => {
    let restoreRenderRootSize = restoreNothing;

    try {
      renderVisualActivity({
        steps: [
          buildVisualStep({
            content: {
              caption: "Wide comparison",
              columns: Array.from(
                { length: 7 },
                (_, index) => `Extremely long comparison column ${index + 1}`,
              ),
              kind: "table",
              rows: Array.from({ length: 4 }, (_row, rowIndex) =>
                Array.from(
                  { length: 7 },
                  (_column, columnIndex) =>
                    `Row ${rowIndex + 1} / Column ${columnIndex + 1} extended content`,
                ),
              ),
            },
            id: "wide-table",
          }),
        ],
      });

      restoreRenderRootSize = setRenderRootSize({ width: "390px" });

      const table = page.getByRole("table");
      const visualContent = page.getByRole("region", { name: /visual content/i });

      await expect.element(table).toBeVisible();

      const tableContainer = table.element().parentElement;

      if (!(tableContainer instanceof HTMLElement)) {
        throw new Error("Expected the table to render inside a scroll container");
      }

      expect(tableContainer.scrollWidth).toBeGreaterThan(tableContainer.clientWidth);
      expect(globalThis.getComputedStyle(tableContainer).overflowX).toBe("auto");
      expect(globalThis.getComputedStyle(visualContent.element()).overflowX).toBe("hidden");
    } finally {
      restoreRenderRootSize();
    }
  });

  test("renders timeline event dates, titles, and descriptions", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            events: [
              {
                date: "1956",
                description: "The Dartmouth workshop coins the term AI.",
                title: "Dartmouth Conference",
              },
              {
                date: "1997",
                description: "Deep Blue defeats Kasparov.",
                title: "Chess Milestone",
              },
            ],
            kind: "timeline",
          },
        }),
      ],
    });

    await expect.element(page.getByRole("figure", { name: /timeline/i })).toBeVisible();
    await expect.element(page.getByText("1956")).toBeVisible();
    await expect.element(page.getByText("Dartmouth Conference")).toBeVisible();
    await expect.element(page.getByText(/deep blue defeats kasparov/i)).toBeVisible();
  });

  test("renders repeated timeline labels without duplicate-key warnings", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderVisualActivity({
        steps: [
          buildVisualStep({
            content: {
              events: [
                {
                  date: "Ao longo do tempo",
                  description: "Primeiro marco dessa ideia.",
                  title: "Primeiro momento",
                },
                {
                  date: "Ao longo do tempo",
                  description: "Segundo marco dessa ideia.",
                  title: "Segundo momento",
                },
              ],
              kind: "timeline",
            },
          }),
        ],
      });

      await expect.element(page.getByRole("figure", { name: /timeline/i })).toBeVisible();
      await expect.element(page.getByText(/primeiro marco dessa ideia/i)).toBeVisible();
      await expect.element(page.getByText(/segundo marco dessa ideia/i)).toBeVisible();

      const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
        String(args[0]).includes("Encountered two children with the same key"),
      );

      expect(duplicateKeyWarnings).toStrictEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test("renders duplicate chart legend labels without duplicate-key warnings", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderVisualActivity({
        steps: [
          buildVisualStep({
            content: {
              chartType: "pie",
              data: [
                { name: "Ao longo do tempo", value: 60 },
                { name: "Ao longo do tempo", value: 40 },
              ],
              kind: "chart",
              title: "Repeated legend labels",
            },
          }),
        ],
      });

      await expect
        .element(page.getByRole("figure", { name: /repeated legend labels/i }))
        .toBeVisible();

      const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
        String(args[0]).includes("Encountered two children with the same key"),
      );

      expect(duplicateKeyWarnings).toStrictEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test("renders duplicate table rows without duplicate-key warnings", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderVisualActivity({
        steps: [
          buildVisualStep({
            content: {
              caption: "Duplicate rows",
              columns: ["Column A", "Column B"],
              kind: "table",
              rows: [
                ["Same", "Row"],
                ["Same", "Row"],
              ],
            },
          }),
        ],
      });

      await expect.element(page.getByRole("figure", { name: /duplicate rows/i })).toBeVisible();

      const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
        String(args[0]).includes("Encountered two children with the same key"),
      );

      expect(duplicateKeyWarnings).toStrictEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test("renders bar, line, and pie charts through the shared chart renderer", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            chartType: "bar",
            data: [
              { name: "Alpha", value: 70 },
              { name: "Beta", value: 45 },
            ],
            kind: "chart",
            title: "Bar chart",
          },
          id: "chart-bar",
        }),
        buildVisualStep({
          content: {
            chartType: "line",
            data: [
              { name: "Jan", value: 10 },
              { name: "Feb", value: 25 },
            ],
            kind: "chart",
            title: "Line chart",
          },
          id: "chart-line",
          position: 1,
        }),
        buildVisualStep({
          content: {
            chartType: "pie",
            data: [
              { name: "Red", value: 40 },
              { name: "Blue", value: 35 },
              { name: "Green", value: 25 },
            ],
            kind: "chart",
            title: "Pie chart",
          },
          id: "chart-pie",
          position: 2,
        }),
      ],
    });

    await expect.element(page.getByRole("figure", { name: "Bar chart" })).toBeVisible();
    await expect.element(page.getByText("Alpha")).toBeVisible();

    await page.getByRole("button", { name: /next step/i }).click();

    await expect.element(page.getByRole("figure", { name: "Line chart" })).toBeVisible();
    await expect.element(page.getByText("Jan")).toBeVisible();

    await page.getByRole("button", { name: /next step/i }).click();

    await expect.element(page.getByRole("figure", { name: "Pie chart" })).toBeVisible();
    await expect.element(page.getByRole("list", { name: /legend/i })).toBeVisible();
    await expect.element(page.getByText("Red")).toBeVisible();
  });

  test("renders diagram nodes and edge labels", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            edges: [
              { label: "routes requests", source: "input", target: "queue" },
              { source: "queue", target: "delivery" },
            ],
            kind: "diagram",
            nodes: [
              { id: "input", label: "Input" },
              { id: "queue", label: "Queue" },
              { id: "delivery", label: "Delivery" },
            ],
          },
        }),
      ],
    });

    const figure = page.getByRole("figure", { name: /diagram/i });

    await expect.element(figure).toBeVisible();
    const diagram = figure.getByRole("img");

    await expect.element(diagram.getByText("Input")).toBeVisible();
    await expect.element(diagram.getByText("Queue")).toBeVisible();
    await expect.element(diagram.getByText("Delivery")).toBeVisible();
    await expect.element(diagram.getByText("routes requests")).toBeVisible();
  });

  test("keeps small diagrams vertically centered inside the visual region", async () => {
    let restoreRenderRootSize = restoreNothing;

    try {
      renderVisualActivity({
        steps: [
          buildVisualStep({
            content: {
              edges: [{ label: "transforms", source: "input", target: "process" }],
              kind: "diagram",
              nodes: [
                { id: "input", label: "Input" },
                { id: "process", label: "Process" },
              ],
            },
          }),
        ],
      });

      restoreRenderRootSize = setRenderRootSize({
        height: "900px",
        width: "1280px",
      });

      const figure = page.getByRole("figure", { name: /diagram/i });
      const visualContent = page.getByRole("region", { name: /visual content/i });

      await expect.element(figure).toBeVisible();

      const spacing = getVerticalSpacing({
        container: visualContent,
        item: figure,
      });

      expect(Math.abs(spacing.top - spacing.bottom)).toBeLessThan(24);
    } finally {
      restoreRenderRootSize();
    }
  });

  test("keeps wide diagram overflow on the nested diagram container", async () => {
    let restoreRenderRootSize = restoreNothing;

    try {
      renderVisualActivity({
        steps: [
          buildVisualStep({
            content: {
              edges: [
                {
                  label:
                    "routes high-priority enterprise procurement requests through a long approval queue",
                  source: "incoming",
                  target: "queue",
                },
                {
                  label:
                    "overloads compliance approvals whenever urgent escalations arrive from legal",
                  source: "urgent",
                  target: "queue",
                },
                {
                  label:
                    "delivers status updates back to the requesting team after operations review",
                  source: "queue",
                  target: "delivery",
                },
              ],
              kind: "diagram",
              nodes: [
                {
                  id: "incoming",
                  label: "Incoming enterprise procurement requests from distributed product teams",
                },
                {
                  id: "urgent",
                  label: "High-priority compliance escalations that need extra legal validation",
                },
                {
                  id: "queue",
                  label: "Awaiting approval from operations and procurement leadership",
                },
                {
                  id: "delivery",
                  label: "Delivery back to the requesting team with procurement status and timing",
                },
              ],
            },
          }),
        ],
      });

      restoreRenderRootSize = setRenderRootSize({ width: "390px" });

      const figure = page.getByRole("figure", { name: /diagram/i });
      const diagram = figure.getByRole("img");
      const visualContent = page.getByRole("region", { name: /visual content/i });

      await expect.element(figure).toBeVisible();

      const diagramContainer = diagram.element().parentElement?.parentElement;

      if (!(diagramContainer instanceof HTMLElement)) {
        throw new Error("Expected the diagram to render inside a scroll container");
      }

      expect(diagramContainer.scrollWidth).toBeGreaterThan(diagramContainer.clientWidth);
      expect(globalThis.getComputedStyle(diagramContainer).overflowX).toBe("auto");
      expect(globalThis.getComputedStyle(visualContent.element()).overflowX).toBe("hidden");
    } finally {
      restoreRenderRootSize();
    }
  });

  test("renders formula visuals with a math region and description", async () => {
    renderVisualActivity({
      steps: [
        buildVisualStep({
          content: {
            description: "Pythagorean theorem",
            formula: "a^2 + b^2 = c^2",
            kind: "formula",
          },
        }),
      ],
    });

    const figure = page.getByRole("figure", { name: "Pythagorean theorem" });

    await expect.element(figure).toBeVisible();
    expect(figure.element().querySelector('[role="math"]')).not.toBeNull();
    await expect.element(page.getByText("Pythagorean theorem")).toBeVisible();
  });
});
