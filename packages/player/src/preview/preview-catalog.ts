import {
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
} from "@zoonk/core/lesson-player/playable-lesson";
import { isExploreTemplate } from "@zoonk/core/library/activities/templates";
import { type ExerciseKind } from "@zoonk/core/player/contracts/exercise-content";
import {
  activityFixtureAreas,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { challengeChartCaseFixture } from "@zoonk/testing/fixtures/challenge-chart-case";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { chartEntries } from "./preview-charts";
import { type PreviewEntry, type PreviewState, entry } from "./preview-entry";
import { heardListeningStep, heardSpokenSentenceStep } from "./preview-heard";
import { buildLesson } from "./preview-lesson";
import {
  type ActivityContent,
  activityStep,
  contentStep,
  diagramPicture,
  explanationStep,
  inlineImage,
  languageStep,
  numberedCheckStep,
  pictureCheckStep,
  teachingStep,
} from "./preview-steps";

export type { PreviewEntry, PreviewState } from "./preview-entry";

function exploreStep({
  content,
  id,
  label,
}: {
  content: ActivityContent;
  id: string;
  label: string;
}): PlayableLibraryStep {
  const { data, fields, prompt, template } = content;

  return explanationStep(
    { explore: { data, fields, template }, text: prompt, title: label },
    { id, image: diagramPicture(content) },
  );
}

const activityEntries = activityFixtureAreas.flatMap(({ fixtures, title }) =>
  Object.entries(fixtures).map(([template, content]) =>
    entry({
      explore: isExploreTemplate(template)
        ? (id) => exploreStep({ content, id, label: template })
        : undefined,
      group: `Activities: ${title}`,
      id: `activity-${template}`,
      label: template,
      screen: (id) => activityStep({ content, id }),
    }),
  ),
);

const engineModeEntries = Object.entries(engineModeFixtures).flatMap(([template, modes]) =>
  Object.entries(modes).map(([mode, content]: [string, ActivityContent]) =>
    entry({
      explore: isExploreTemplate(template)
        ? (id) => exploreStep({ content, id, label: `${template}: ${mode}` })
        : undefined,
      group: "Activities: engine modes",
      id: `activity-${template}-${mode}`,
      label: `${template}: ${mode}`,
      screen: (id) => activityStep({ content, id }),
    }),
  ),
);

const PLANETS_TABLE = [
  "| Planet | Distance from the Sun | Length of a year | Moons |",
  "|---|---:|---:|---:|",
  "| Mercury | 58 million km | 88 days | 0 |",
  "| Mars | 228 million km | 687 days | 2 |",
].join("\n");

const BRAIN = {
  alt: "The brain from the side with the frontal lobe at the front",
  text: "The **frontal lobe** sits behind your forehead. It plans what you do next.",
  title: "The frontal lobe",
};

const screenEntries: PreviewEntry[] = [
  entry({
    group: "Lesson screens",
    id: "hook-guess",
    label: "Hook: a guess",
    screen: (id) => teachingStep("hook", { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "hook-text",
    label: "Hook: a fact",
    screen: (id) =>
      contentStep("hook", {
        content: { text: playableStepContent.hook.reveal, variant: "text" },
        id,
      }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation",
    label: "Explanation",
    screen: (id) => teachingStep("explanation", { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-table",
    label: "Explanation with a table",
    screen: (id) =>
      explanationStep(
        { text: `Compare two rocky planets:\n\n${PLANETS_TABLE}`, title: "Two rocky planets" },
        { id },
      ),
  }),
  ...chartEntries,
  entry({
    group: "Lesson screens",
    id: "worked-example",
    label: "Worked example",
    screen: (id) => teachingStep("workedExample", { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "check",
    label: "Check",
    screen: (id) => teachingStep("check", { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "typed-answer",
    label: "Typed answer",
    screen: (id) => teachingStep("typedAnswer", { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "spoken-answer",
    label: "Spoken answer",
    screen: (id) => heardSpokenSentenceStep({ id }),
  }),
  entry({
    group: "Lesson screens",
    id: "listening",
    label: "Listening",
    screen: (id) => heardListeningStep({ id }),
  }),
  entry({
    group: "Lesson screens",
    id: "summary",
    label: "Summary",
    screen: (id) => teachingStep("summary", { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "challenge",
    label: "Challenge",
    screen: (id) => teachingStep("challenge", { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "challenge-chart",
    label: "Challenge with a chart",
    screen: (id) => contentStep("challenge", { content: challengeChartCaseFixture(), id }),
  }),
];

const pictureEntries: PreviewEntry[] = [
  entry({
    group: "Pictures",
    id: "picture-explanation",
    label: "Explanation led by its picture",
    screen: (id) =>
      explanationStep(
        { image: { alt: BRAIN.alt, prompt: BRAIN.alt }, text: BRAIN.text, title: BRAIN.title },
        { id, image: inlineImage({ alt: BRAIN.alt, id: `${id}-image`, kind: "scene" }) },
      ),
  }),
  entry({
    group: "Pictures",
    id: "picture-pending",
    label: "Explanation while its picture is drawn",
    screen: (id) =>
      explanationStep(
        { image: { alt: BRAIN.alt, prompt: BRAIN.alt }, text: BRAIN.text, title: BRAIN.title },
        { id, imagePending: true },
      ),
  }),
  entry({
    group: "Pictures",
    id: "picture-question",
    label: "Question about a picture",
    screen: (id) => {
      const alt = "Otávio stands next to a blue bike, both feet on the ground";
      const base = teachingStep("check", { id, image: inlineImage({ alt, id: `${id}-image` }) });

      return {
        ...base,
        content: {
          ...base.content,
          image: { alt, prompt: alt },
          question: "Which caption fits the picture?",
        },
      };
    },
  }),
  entry({
    group: "Pictures",
    id: "picture-numbered-question",
    label: "Which number marks a part",
    screen: (id) => numberedCheckStep({ id }),
  }),
  entry({
    group: "Pictures",
    id: "picture-options",
    label: "Question whose options are pictures",
    screen: (id) => pictureCheckStep({ id }),
  }),
  entry({
    group: "Pictures",
    id: "picture-options-pending",
    label: "Picture options while one is drawn",
    screen: (id) => pictureCheckStep({ drawn: ["gothic", "romanesque"], id, imagePending: true }),
  }),
  entry({
    group: "Pictures",
    id: "picture-options-missing",
    label: "Picture options when one never came",
    screen: (id) => pictureCheckStep({ drawn: ["gothic", "romanesque"], id }),
  }),
];

const LANGUAGE_KINDS: readonly ExerciseKind[] = [
  "vocabulary",
  "translation",
  "reading",
  "listening",
  "fillBlank",
  "matchColumns",
  "multipleChoice",
  "alphabet",
];

const languageEntries = LANGUAGE_KINDS.map((kind) =>
  entry({
    group: "Language",
    id: `language-${kind}`,
    label: kind,
    screen: (id) => languageStep(kind, undefined, { id }),
  }),
);

export const previewEntries: readonly PreviewEntry[] = [
  ...activityEntries,
  ...engineModeEntries,
  ...screenEntries,
  ...pictureEntries,
  ...languageEntries,
];

export function getPreviewEntry(id: string): PreviewEntry | null {
  return previewEntries.find((item) => item.id === id) ?? null;
}

/** Build once per preview and reuse for PlayerPreview; rebuilding reshuffles language options. */
export function previewLesson(
  { id, label, screen }: PreviewEntry,
  state: PreviewState,
): PlayableLibraryLesson {
  return buildLesson([screen(state)], { id, title: label });
}
