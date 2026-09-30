import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";

export type LessonImageInput = {
  /** Names the saved image file. */
  caseId: string;
  scene: ImageScene;
  language: string;
  /** The course category that picks the palette. */
  category: string | null;
};

function scene(fields: Partial<ImageScene> & Pick<ImageScene, "focalObject">): ImageScene {
  return {
    labels: [],
    layout: "single",
    motion: null,
    relation: null,
    supportingObjects: [],
    ...fields,
  };
}

const TEXT_RULE =
  "Only the listed labels may appear, each spelled exactly as given and easy to read. Any other text, gibberish letters or a misspelled label is a major error.";

const NO_TEXT_RULE =
  "The image must contain no text at all: any letters, numbers or captions are a major error.";

/**
 * The mockup board's six examples: fixed scenes, so the comparison isolates the
 * image model and the style block from scene writing.
 */
export const TEST_CASES = [
  {
    expectations: `One idea: a discount. An old tag with "antes R$ 80" crossed out, a new tag with "você paga R$ 60" and a -25% badge between them. ${TEXT_RULE}`,
    id: "discount-pt",
    userInput: {
      caseId: "discount-pt",
      category: "business",
      language: "pt",
      scene: scene({
        focalObject: "two price tags: an old tag with its price crossed out and a new tag",
        labels: [
          { target: "on the old tag", text: "antes R$ 80" },
          { target: "on the new tag", text: "você paga R$ 60" },
          { target: "on the round badge", text: "-25%" },
        ],
        layout: "sequence",
        relation: "a round amber badge sits between the old tag and the new tag",
        supportingObjects: ["a round badge"],
      }),
    },
  },
  {
    expectations: `An electron cloud: tiny dots densest around a small red nucleus and fading outward, so the image shows where the electron is likely to be. ${TEXT_RULE}`,
    id: "electron-cloud-en",
    userInput: {
      caseId: "electron-cloud-en",
      category: "science",
      language: "en",
      scene: scene({
        focalObject:
          "a cloud of tiny dots around a small red nucleus, densest in the middle and fading outward",
        labels: [
          { target: "next to the small red nucleus", text: "nucleus" },
          { target: "next to the dense cloud of dots", text: "electron cloud" },
        ],
      }),
    },
  },
  {
    expectations: `Cause and effect: a microwave heating a bowl of soup, linked by one dashed line to a spinning water molecule. ${TEXT_RULE}`,
    id: "microwave-en",
    userInput: {
      caseId: "microwave-en",
      category: "science",
      language: "en",
      scene: scene({
        focalObject:
          "a microwave oven with a bowl of steaming soup inside and wavy lines in the oven",
        labels: [{ target: "next to the spinning molecule", text: "water molecules" }],
        layout: "sequence",
        motion: "curved arrows show the water molecule spinning",
        relation:
          "a thin dashed line links the soup to a water molecule drawn in a circle beside the oven",
        supportingObjects: ["a water molecule in a circle"],
      }),
    },
  },
  {
    expectations: `A comparison: Earth orbiting the Sun next to an electron orbiting a nucleus, same size, so the question becomes visible. ${TEXT_RULE}`,
    id: "orbits-comparison-en",
    userInput: {
      caseId: "orbits-comparison-en",
      category: "science",
      language: "en",
      scene: scene({
        focalObject: "the Sun with Earth on a dashed elliptical orbit",
        labels: [
          { target: "under the Sun and Earth", text: "Earth and Sun" },
          { target: "under the nucleus and electron", text: "Electron and nucleus?" },
        ],
        layout: "comparison",
        relation: "the two orbits sit side by side at the same size",
        supportingObjects: ["a tiny nucleus with an electron on a dashed elliptical orbit"],
      }),
    },
  },
  {
    expectations: `Motion with a few lines: an electron on a dashed orbit around a nucleus, with a red dashed path spiraling inward and one arrowhead, showing the fall classical physics predicted. ${TEXT_RULE}`,
    id: "spiral-en",
    userInput: {
      caseId: "spiral-en",
      category: "science",
      language: "en",
      scene: scene({
        focalObject: "a small red nucleus with a blue electron on a faint dashed circular orbit",
        labels: [{ target: "next to the blue electron", text: "electron" }],
        motion:
          "a red dashed path spirals inward from the electron to the nucleus, with one arrowhead",
      }),
    },
  },
  {
    expectations: `A language course scene: a small house with a sign for rent that shows a key symbol. ${NO_TEXT_RULE}`,
    id: "house-language",
    userInput: {
      caseId: "house-language",
      category: "languages",
      language: "pt",
      scene: scene({
        focalObject: "a small house with a yellow door",
        relation: "a sign on a post stands beside the house and shows only a key symbol",
        supportingObjects: ["a sign on a post with a key symbol"],
      }),
    },
  },
] satisfies { expectations: string; id: string; userInput: LessonImageInput }[];
