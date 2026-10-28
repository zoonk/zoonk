import { type WrittenChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { seededShuffle } from "@zoonk/utils/seeded-random";
import { describeContentIssues, safeParseStepContent } from "../steps/contract/step-contract";
import { type ChallengeLessonSpec } from "./challenge-lesson-spec";

type WrittenPanel = WrittenChallengeCase["panels"][number];
type WrittenNode = WrittenChallengeCase["nodes"][number];

function optional<TValue>(value: TValue | null): TValue | undefined {
  return value ?? undefined;
}

function toPanel(panel: WrittenPanel) {
  return {
    metrics: panel.metrics.map((metric) => ({
      label: metric.label,
      note: optional(metric.note),
      value: metric.value,
    })),
    note: optional(panel.note),
    title: optional(panel.title),
  };
}

function toChoice(choice: WrittenNode["choices"][number]) {
  return {
    effects: choice.effects,
    id: choice.id,
    next: choice.next,
    notes: choice.notes.map((note) => ({
      example: optional(note.example),
      kind: note.kind,
      skill: note.skill,
      text: note.text,
    })),
    quality: choice.quality,
    replies: choice.replies,
    text: choice.text,
    timeJump: choice.timeJump
      ? {
          label: choice.timeJump.label,
          panel: choice.timeJump.panel ? toPanel(choice.timeJump.panel) : undefined,
        }
      : undefined,
  };
}

function toChoices({ node, title }: { node: WrittenNode; title: string }) {
  return seededShuffle(
    node.choices.map((choice) => toChoice(choice)),
    `${title}:${node.id}`,
  );
}

function toChallengeContent({
  variant,
  written,
}: {
  variant: ChallengeLessonSpec["variant"];
  written: WrittenChallengeCase;
}) {
  return {
    deadline: optional(written.deadline),
    endings: written.endings,
    meters: written.meters,
    mission: written.mission,
    nodes: written.nodes.map((node) => ({
      choices: toChoices({ node, title: written.title }),
      id: node.id,
      messages: node.messages,
      prompt: node.prompt,
    })),
    panels: written.panels.map((panel) => toPanel(panel)),
    setting: written.setting,
    skills: written.skills,
    startNodeId: written.startNodeId,
    team: written.team,
    title: written.title,
    variant,
  };
}

export function checkWrittenChallenge({
  variant,
  written,
}: {
  variant: ChallengeLessonSpec["variant"];
  written: WrittenChallengeCase;
}) {
  const parsed = safeParseStepContent("challenge", toChallengeContent({ variant, written }));

  return parsed.success
    ? { content: parsed.data, problems: [] }
    : { content: null, problems: describeContentIssues(parsed.error) };
}
