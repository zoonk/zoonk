import { challengeCaseFixture } from "./challenge-contents";

type PanelFixture = {
  metrics: { label: string; note?: string; value: string }[];
  note?: string;
  title?: string;
};

function writtenPanel(panel: PanelFixture) {
  return {
    metrics: panel.metrics.map((metric) => ({
      label: metric.label,
      note: metric.note ?? null,
      value: metric.value,
    })),
    note: panel.note ?? null,
    title: panel.title ?? null,
  };
}

export function writtenChallengeCaseFixture() {
  const { variant: _variant, ...content } = challengeCaseFixture();

  return {
    ...content,
    nodes: content.nodes.map((node) => ({
      ...node,
      choices: node.choices.map((choice) => ({
        ...choice,
        notes: choice.notes.map((note) => ({
          example: "example" in note ? note.example : null,
          kind: note.kind,
          skill: note.skill,
          text: note.text,
        })),
        timeJump:
          "timeJump" in choice && choice.timeJump
            ? { label: choice.timeJump.label, panel: writtenPanel(choice.timeJump.panel) }
            : null,
      })),
      visual: null,
    })),
    panels: content.panels.map((panel) => writtenPanel(panel)),
    summary: [
      "A gap between two versions can be chance when few people saw them.",
      "Explain a test result in plain words to people who aren't data people.",
    ],
  };
}

export function challengePlotFixture() {
  return {
    kind: "plot" as const,
    references: [{ label: "Control limit", y: 40 }],
    series: [
      {
        mark: "lineWithPoints" as const,
        name: "Scan A",
        points: [
          { label: null, x: 10, y: 27 },
          { label: "Valley", x: 11, y: 25 },
          { label: null, x: 20, y: 30 },
        ],
      },
    ],
    source: null,
    title: "Pressure over time",
    xLabel: "Time",
    xUnit: "s",
    yLabel: "Pressure",
    yUnit: "kPa",
  };
}
