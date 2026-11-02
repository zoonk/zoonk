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
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { rightAnswer } from "./preview-answers";
import { buildLesson } from "./preview-lesson";
import {
  type ActivityContent,
  activityStep,
  contentStep,
  diagramPicture,
  explanationStep,
  inlineImage,
  languageStep,
  lawTimeline,
  lettersChart,
  numberedCheckStep,
  pictureCheckStep,
  spokenAnswerStep,
  teachingStep,
} from "./preview-steps";

export type PreviewState = "answering" | "checked" | "explore" | "reading";

export type PreviewEntry = {
  group: string;
  id: string;
  label: string;
  screen: (state: PreviewState) => PlayableLibraryStep;
  states: readonly PreviewState[];
};

function previewId(entryId: string): string {
  return `preview-${entryId}`;
}

function statesOf(screen: PlayableLibraryStep): readonly PreviewState[] {
  if (rightAnswer(screen)) {
    return ["answering", "checked"];
  }

  const asks = "exercise" in screen || screen.kind === "activity" || screen.kind === "spokenAnswer";
  return asks ? ["answering"] : ["reading"];
}

function entry({
  explore,
  group,
  id,
  label,
  screen,
}: Omit<PreviewEntry, "screen" | "states"> & {
  explore?: (id: string) => PlayableLibraryStep;
  screen: (id: string) => PlayableLibraryStep;
}): PreviewEntry {
  const build = (state: PreviewState) =>
    state === "explore" && explore ? explore(previewId(id)) : screen(previewId(id));

  const states = statesOf(build("answering"));
  return { group, id, label, screen: build, states: explore ? ["explore", ...states] : states };
}

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
  entry({
    group: "Lesson screens",
    id: "explanation-chart",
    label: "Explanation with a chart",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: lettersChart }, { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-timeline",
    label: "Explanation with a timeline",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: lawTimeline }, { id }),
  }),
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
    screen: (id) => spokenAnswerStep({ id }),
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
];

const pictureEntries: PreviewEntry[] = [
  entry({
    group: "Pictures",
    id: "picture-explanation",
    label: "Explanation led by its picture",
    screen: (id) =>
      explanationStep(
        { image: { alt: BRAIN.alt, prompt: BRAIN.alt }, text: BRAIN.text, title: BRAIN.title },
        { id, image: inlineImage({ alt: BRAIN.alt, id: `${id}-image` }) },
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
