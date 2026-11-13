import { type ChallengeContent } from "../steps/contract/challenge-content";
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

function formatDecision({ node, routes }: { node: WrittenNode; routes: string[] }): string {
  return [
    `## Decision "${node.id}"`,
    `Reached after: ${routes.join(" | ")}`,
    ...node.messages.map((message) => `  {{${message.from}}}: ${message.text}`),
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
