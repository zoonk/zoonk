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

/**
 * `challengeCaseFixture` as the case writer returns it: every field present, null for "none",
 * no variant (code sets it from the lesson's spec) and a summary card.
 */
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
    })),
    panels: content.panels.map((panel) => writtenPanel(panel)),
    summary: [
      "A gap between two versions can be chance when few people saw them.",
      "Explain a test result in plain words to people who aren't data people.",
    ],
  };
}
