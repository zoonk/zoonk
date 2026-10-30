import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/playable-lesson";
import {
  numberedCheckContent,
  pictureCheckContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { toAppSteps } from "./app-steps";

const places = [
  {
    id: "pump",
    label: "Broad Street pump",
    latitude: 51.51334,
    longitude: -0.13667,
    reveals: "Most deaths cluster around it.",
  },
  {
    id: "brewery",
    label: "Brewery",
    latitude: 51.5137,
    longitude: -0.1361,
    reveals: "Its workers drank beer.",
  },
];

const stepBase = { citation: null, image: null, imagePending: false, position: 0, skillId: null };

const mapActivity = {
  ...stepBase,
  content: {
    check: {
      kind: "choice",
      options: [
        { id: "a", isCorrect: true, reason: "The deaths cluster there.", text: "The pump" },
        { id: "b", isCorrect: false, reason: "Its workers were spared.", text: "The brewery" },
      ],
      question: "Where did the outbreak start?",
    },
    fields: { baseMapId: "london-1854", places },
    prompt: "Trace the outbreak.",
    template: "mapExplorer",
  },
  id: "map",
  kind: "activity",
  minTolerance: null,
} satisfies PlayableLibraryStep;

const explanation = {
  ...stepBase,
  content: {
    explore: { fields: { baseMapId: "london-1854", places }, template: "mapExplorer" },
    text: "John Snow mapped the deaths.",
  },
  id: "explained",
  kind: "explanation",
} satisfies PlayableLibraryStep;

const summary = {
  ...stepBase,
  content: { ideas: [{ text: "Maps find causes." }] },
  id: "summary",
  kind: "summary",
} satisfies PlayableLibraryStep;

describe(toAppSteps, () => {
  it("sends a map activity's base map with its places projected", async () => {
    const [step] = await toAppSteps([mapActivity]);

    expect(step).toMatchObject({ baseMap: { places: [{ id: "pump" }, { id: "brewery" }] } });
    expect(step && "baseMap" in step && step.baseMap).not.toHaveProperty("projection");
  });

  it("sends the base map an explanation explores", async () => {
    const [step] = await toAppSteps([explanation]);

    expect(step).toMatchObject({ baseMap: { places: [{ id: "pump" }, { id: "brewery" }] } });
  });

  it("gives other activities and explanations none and leaves other screens as they are", async () => {
    const plain = {
      ...explanation,
      content: { text: "No map here." },
      id: "plain",
    } satisfies PlayableLibraryStep;

    const steps = await toAppSteps([plain, summary]);

    expect(steps).toStrictEqual([
      { ...plain, baseMap: null, picture: null },
      { ...summary, picture: null },
    ]);
  });

  it("sends each screen's own picture, required only when its question is about numbered parts", async () => {
    const numbered = {
      ...stepBase,
      content: numberedCheckContent,
      id: "numbered",
      kind: "check",
    } satisfies PlayableLibraryStep;

    const pictureOptions = {
      ...numbered,
      content: pictureCheckContent,
      id: "pictureOptions",
    } satisfies PlayableLibraryStep;

    const plainPicture = {
      ...numbered,
      content: { ...numberedCheckContent, image: { alt: "A tulip", prompt: "A red tulip" } },
      id: "plainPicture",
    } satisfies PlayableLibraryStep;

    const steps = await toAppSteps([numbered, pictureOptions, plainPicture]);

    expect(steps.map((step) => "picture" in step && step.picture)).toStrictEqual([
      { alt: numberedCheckContent.image.alt, required: true },
      null,
      { alt: "A tulip", required: false },
    ]);
  });
});
