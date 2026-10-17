import { type WrittenChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { seededShuffle } from "@zoonk/utils/seeded-random";
import { describeContentIssues, safeParseStepContent } from "../steps/contract/step-contract";
import { type ChallengeLessonSpec } from "./challenge-lesson-spec";

type WrittenPanel = WrittenChallengeCase["panels"][number];
type WrittenNode = WrittenChallengeCase["nodes"][number];

/** Models write null for "none"; the contract leaves an optional field out instead. */
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

/**
 * Writers tend to list the strongest choice first, which teaches learners to pick the top one. The
 * order is shuffled once, from the case and decision, so it stays put on every replay.
 */
function toChoices({ node, title }: { node: WrittenNode; title: string }) {
  return seededShuffle(
    node.choices.map((choice) => toChoice(choice)),
    `${title}:${node.id}`,
  );
}

/**
 * Turns the case writer's output into challenge step content. The variant comes from the lesson's
 * spec, not the model; the step contract then checks the result.
 */
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

/**
 * The case writer's output as stored challenge content, checked against the step contract (the
 * decision graph included). Problems say what to fix, for another draft or an eval.
 */
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
