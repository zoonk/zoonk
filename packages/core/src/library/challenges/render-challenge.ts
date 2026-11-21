import { formatWithUnit } from "@zoonk/utils/math-answer";
import { formatTicks, getChartValueAxis, getPlotAxes } from "@zoonk/utils/plot-scale";
import { type ChallengeContent } from "../steps/contract/challenge-content";
import { placeChartUnit } from "../steps/contract/chart-unit";
import {
  type ChallengeVisual,
  type ChartVisual,
  type PlotVisual,
} from "../steps/contract/step-contract";
import {
  type ChallengePath,
  type ChallengeStep as PathStep,
  listChallengePaths as listPaths,
} from "./challenge-graph";
import { getChallengeMeters } from "./challenge-run";

type WrittenChallengeCase = ChallengeContent & { summary: string[] };

type WrittenNode = WrittenChallengeCase["nodes"][number];
type WrittenChoice = WrittenNode["choices"][number];
type WrittenPanel = WrittenChallengeCase["panels"][number];

function formatPanel(panel: WrittenPanel): string {
  const metrics = panel.metrics.map(
    (metric) => `  - ${metric.label}: ${metric.value}${metric.note ? ` (${metric.note})` : ""}`,
  );

  return [
    `  Panel${panel.title ? ` "${panel.title}"` : ""}:`,
    ...metrics,
    ...(panel.note ? [`  Panel note: ${panel.note}`] : []),
  ].join("\n");
}

function formatCase(written: WrittenChallengeCase): string {
  return [
    `Title: ${written.title}`,
    `Setting: ${written.setting}`,
    `Mission: ${written.mission}`,
    `Deadline: ${written.deadline ?? "none"}`,
    "Team:",
    ...written.team.map(
      (member) =>
        `  - {{${member.id}}}: ${member.role}${member.ai ? " (AI assistant)" : ""}. ${member.expertise}`,
    ),
    "Meters:",
    ...written.meters.map(
      (meter) =>
        `  - ${meter.id} "${meter.label}": starts at ${meter.start}, good when ${meter.goodWhen}`,
    ),
    "Skills:",
    ...written.skills.map((skill) => `  - ${skill.id}: ${skill.name}`),
    "Opening panels:",
    ...written.panels.map((panel) => formatPanel(panel)),
    "Summary card:",
    ...written.summary.map((idea) => `  - ${idea}`),
  ].join("\n");
}

function formatRoute(steps: PathStep[]): string {
  return steps.length === 0
    ? "the start"
    : steps.map((step) => `${step.node.id}:${step.choice.id}`).join(" → ");
}

function formatChoice(choice: WrittenChoice): string {
  const effects = choice.effects.map(
    (effect) => `${effect.meter} ${effect.change >= 0 ? "+" : ""}${effect.change}`,
  );

  const jump = choice.timeJump
    ? [
        `    Time jump: ${choice.timeJump.label}`,
        ...(choice.timeJump.panel
          ? [formatPanel(choice.timeJump.panel).replaceAll(/^/gmu, "  ")]
          : []),
      ]
    : [];

  return [
    `  Choice ${choice.id} (graded ${choice.quality}, leads to "${choice.next}"): ${choice.text}`,
    ...choice.replies.map((reply) => `    {{${reply.from}}} replies: ${reply.text}`),
    ...(effects.length > 0 ? [`    Meters: ${effects.join(", ")}`] : []),
    ...jump,
    ...choice.notes.map(
      (note) =>
        `    Debrief note [${note.kind}, ${note.skill}]: ${note.text}${note.example ? ` Example: ${note.example}` : ""}`,
    ),
  ].join("\n");
}

/** The labels a learner's screen prints beside each tick, in English notation like the rest of the map. */
function quoteTicks(labels: string[]): string {
  return labels.map((label) => `"${label}"`).join(" ");
}

function formatPlot(visual: PlotVisual): string[] {
  const axes = getPlotAxes(visual);
  const xAxis = placeChartUnit({ label: visual.xLabel, unit: visual.xUnit });
  const yAxis = placeChartUnit({ label: visual.yLabel, unit: visual.yUnit });

  const xTicks = formatTicks({
    axis: "x",
    locale: "en",
    ticks: axes.x.ticks,
    unit: xAxis.numberUnit,
  });

  const yTicks = formatTicks({
    axis: "y",
    locale: "en",
    ticks: axes.y.ticks,
    unit: yAxis.numberUnit,
  });

  return [
    `  X axis: ${xAxis.label}`,
    `  Y axis: ${yAxis.label}`,
    `  X tick labels (at most these): ${quoteTicks(xTicks)}`,
    `  Y tick labels: ${quoteTicks(yTicks)}`,
    ...visual.series.map(({ mark, name, points }) => {
      const positions = points.map(
        ({ label, x, y }) => `${label ? `"${label}" ` : ""}(${x}, ${y})`,
      );

      return `  Series "${name}" (${mark}): ${positions.join(", ")}`;
    }),
    ...visual.references.map(({ label, y }) => `  Horizontal reference "${label}": y = ${y}`),
  ];
}

function formatCategoryChart(visual: ChartVisual): string[] {
  const { ticks } = getChartValueAxis(visual);
  const { label, numberUnit } = placeChartUnit({ label: visual.valueLabel, unit: visual.unit });
  const mark = visual.chart === "bar" ? "bar" : "lineWithPoints";
  const tickLabels = formatTicks({ axis: "y", locale: "en", ticks, unit: numberUnit });

  return [
    `  Category axis: ${visual.categoryLabel}`,
    `  Value axis: ${label}`,
    `  Categories: ${visual.categories.join(", ")}`,
    `  Value tick labels (at most these): ${quoteTicks(tickLabels)}`,
    ...visual.series.map(({ name, values }) => {
      const points = values.map((value, index) => `${visual.categories[index]} = ${value}`);

      const labels = values.map((value) =>
        formatWithUnit({ locale: "en", unit: numberUnit, value }),
      );

      return `  Series "${name}" (${mark}): ${points.join(", ")}. Value labels when they fit: ${labels.join(", ")}`;
    }),
  ];
}

function formatVisual(visual: ChallengeVisual): string[] {
  return [
    `  Chart: ${visual.title}`,
    ...(visual.kind === "plot" ? formatPlot(visual) : formatCategoryChart(visual)),
    ...(visual.source ? [`  Source: ${visual.source}`] : []),
    "  Only the ticks, labels and marks are visible to the learner.",
  ];
}

function formatDecision({ node, routes }: { node: WrittenNode; routes: string[] }): string {
  return [
    `## Decision "${node.id}"`,
    `Reached after: ${routes.join(" | ")}`,
    ...node.messages.map((message) => `  {{${message.from}}}: ${message.text}`),
    ...(node.visual ? formatVisual(node.visual) : []),
    `  Prompt: ${node.prompt}`,
    ...node.choices.map((choice) => formatChoice(choice)),
  ].join("\n");
}

function pathMeters({ path, written }: { path: ChallengePath; written: WrittenChallengeCase }) {
  const content = written;

  const steps = path.steps.map((step) => {
    const node = content.nodes.find((item) => item.id === step.node.id);

    if (!node) {
      throw new Error(`Missing node ${step.node.id}`);
    }

    const choice = node.choices.find((item) => item.id === step.choice.id);

    if (!choice) {
      throw new Error(`Missing choice ${step.choice.id}`);
    }

    return { choice, node };
  });

  return getChallengeMeters(content, steps);
}

function finalMeters(params: { path: ChallengePath; written: WrittenChallengeCase }) {
  return pathMeters(params)
    .map(({ id, value }) => `${id} ${value}`)
    .join(", ");
}

/**
 * Every path's own transcript repeats shared steps, which grows to 500k characters on a 120-path
 * case, so each decision and choice appears once with the routes that reach it, then every path as
 * its route.
 */
export function renderChallengeMap(written: WrittenChallengeCase): {
  pathCount: number;
  text: string;
} {
  const paths = listPaths(written);

  const routesTo = (nodeId: string) => [
    ...new Set(
      paths.flatMap((path) => {
        const index = path.steps.findIndex((step) => step.node.id === nodeId);
        return index === -1 ? [] : [formatRoute(path.steps.slice(0, index))];
      }),
    ),
  ];

  const reachable = written.nodes.filter((node) => routesTo(node.id).length > 0);

  return {
    pathCount: paths.length,
    text: [
      "# The case",
      formatCase(written),
      "# Decisions",
      ...reachable.map((node) => formatDecision({ node, routes: routesTo(node.id) })),
      "# Endings",
      ...written.endings.map((ending) => `- ${ending.id}: ${ending.outcome}`),
      "# Paths",
      ...paths.map(
        (path, index) =>
          `- Path ${index + 1}: ${formatRoute(path.steps)} → ending "${path.endingId}" (meters at the end: ${finalMeters({ path, written })})`,
      ),
    ].join("\n\n"),
  };
}
