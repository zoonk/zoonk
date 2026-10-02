import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { TEST_CASES as IMAGE_CASES } from "../lesson-image/test-cases";

export type ImageCheckCaseInput = {
  /** A file in `datasets/images/image-check`, drawn by the lesson-image eval or planted. */
  imageFile: string;
  scene: ImageScene;
  language: string;
};

export type ImageCheckExpected = { passed: boolean };

function sceneOf(caseId: string): { language: string; scene: ImageScene } {
  const found = IMAGE_CASES.find((testCase) => testCase.id === caseId);

  if (!found) {
    throw new Error(`Unknown lesson-image case: ${caseId}`);
  }

  return { language: found.userInput.language, scene: found.userInput.scene };
}

function checkCase({
  expected,
  id,
  imageFile,
  input,
}: {
  expected: boolean;
  id: string;
  imageFile: string;
  input: { language: string; scene: ImageScene };
}) {
  return { expected: { passed: expected }, id, userInput: { imageFile, ...input } };
}

/** Scenes from a real overview-goal run, where the drawing model named objects nobody asked it to. */
const electronHook: ImageScene = {
  focalObject: "a small blue dot representing an electron, inside a small dashed boundary",
  labels: [{ target: "above the dashed arrow", text: "?" }],
  layout: "single",
  motion: "a dashed straight arrow pointing outward from the dot",
  relation: null,
  supportingObjects: [],
};

const qubitDevice: ImageScene = {
  focalObject: "a small tabletop measurement device with a blank digital display screen",
  labels: [
    { target: "on the device, left of the screen", text: "0" },
    { target: "on the device, right of the screen", text: "1" },
  ],
  layout: "single",
  motion: null,
  relation: "a tiny particle sits on top of the device, above the blank screen",
  supportingObjects: ["a tiny particle on top of the device"],
};

const positionRegions: ImageScene = {
  focalObject: "a wide fuzzy shaded oval cloud of possible electron positions",
  labels: [
    { target: "above the wide region on the left", text: "Could be anywhere here" },
    { target: "above the narrow region on the right", text: "Could be here" },
  ],
  layout: "comparison",
  motion: null,
  relation: "the wide region is on the left and the narrow region is on the right",
  supportingObjects: ["a much narrower fuzzy shaded oval cloud"],
};

/** A square leaf picture with no text, from when chapters had covers: a clean no-text image. */
const leaf: { language: string; scene: ImageScene } = {
  language: "en",
  scene: {
    focalObject: "a green leaf catching rays of sunlight",
    labels: [],
    layout: "single",
    motion: null,
    relation: null,
    supportingObjects: ["a small sun"],
  },
};

const discount = sceneOf("discount-pt");
const electronCloud = sceneOf("electron-cloud-en");
const microwave = sceneOf("microwave-en");

/**
 * Images the lesson-image eval and a real goal run drew, labeled by hand
 * after review (images a reviewer could read either way are left out):
 * allowed labels written in different ways must pass, and names the drawing
 * model added on its own must fail. Plus planted failures: a good image
 * checked against the wrong scene, wrong or foreign labels, text where none
 * is allowed, and two off-style renders.
 */
export const TEST_CASES = [
  checkCase({
    expected: true,
    id: "flare-discount",
    imageFile: "flare-discount-pt.webp",
    input: discount,
  }),
  checkCase({
    expected: true,
    id: "flare-electron-cloud",
    imageFile: "flare-electron-cloud-en.webp",
    input: electronCloud,
  }),
  checkCase({
    expected: true,
    id: "flare-microwave",
    imageFile: "flare-microwave-en.webp",
    input: microwave,
  }),
  checkCase({
    expected: true,
    id: "flare-spiral",
    imageFile: "flare-spiral-en.webp",
    input: sceneOf("spiral-en"),
  }),
  checkCase({
    expected: true,
    id: "flare-house",
    imageFile: "flare-house-language.webp",
    input: sceneOf("house-language"),
  }),
  checkCase({
    expected: true,
    id: "flare-cover",
    imageFile: "flare-cover-photosynthesis.webp",
    input: leaf,
  }),
  checkCase({
    expected: true,
    id: "gpt2-discount",
    imageFile: "gpt2-discount-pt.webp",
    input: discount,
  }),
  checkCase({
    expected: true,
    id: "gpt2-cover",
    imageFile: "gpt2-cover-photosynthesis.webp",
    input: leaf,
  }),
  checkCase({
    expected: false,
    id: "unrequested-labels",
    imageFile: "flare-orbits-comparison-en.webp",
    input: sceneOf("orbits-comparison-en"),
  }),
  checkCase({
    expected: false,
    id: "two-panels",
    imageFile: "gpt2-microwave-en.webp",
    input: microwave,
  }),
  checkCase({
    expected: false,
    id: "extra-label",
    imageFile: "gpt2-spiral-en.webp",
    input: sceneOf("spiral-en"),
  }),
  checkCase({
    expected: false,
    id: "wrong-idea",
    imageFile: "flare-house-language.webp",
    input: microwave,
  }),
  checkCase({
    expected: false,
    id: "wrong-prices",
    imageFile: "flare-discount-pt.webp",
    input: {
      ...discount,
      scene: {
        ...discount.scene,
        labels: [
          { target: "on the old tag", text: "antes R$ 90" },
          { target: "on the new tag", text: "você paga R$ 70" },
          { target: "on the round badge", text: "-25%" },
        ],
      },
    },
  }),
  checkCase({
    expected: false,
    id: "text-not-allowed",
    imageFile: "flare-electron-cloud-en.webp",
    input: { ...electronCloud, scene: { ...electronCloud.scene, labels: [] } },
  }),
  checkCase({
    expected: false,
    id: "wrong-object",
    imageFile: "flare-cover-photosynthesis.webp",
    input: {
      language: "en",
      scene: {
        ...microwave.scene,
        focalObject: "a red apple on a white plate",
        labels: [],
        layout: "single",
        motion: null,
        relation: null,
        supportingObjects: [],
      },
    },
  }),
  checkCase({
    expected: false,
    id: "label-wrong-language",
    imageFile: "flare-microwave-en.webp",
    input: {
      language: "pt",
      scene: {
        ...microwave.scene,
        labels: [{ target: "next to the spinning molecule", text: "moléculas de água" }],
      },
    },
  }),
  checkCase({
    expected: true,
    id: "allowed-phrase-labels",
    imageFile: "text-allowed-phrases.webp",
    input: { language: "en", scene: positionRegions },
  }),
  checkCase({
    expected: true,
    id: "allowed-labels-on-object",
    imageFile: "text-allowed-on-object.webp",
    input: { language: "en", scene: qubitDevice },
  }),
  checkCase({
    expected: true,
    id: "allowed-symbol-label",
    imageFile: "text-allowed-symbol.webp",
    input: { language: "en", scene: electronHook },
  }),
  checkCase({
    expected: false,
    id: "extra-object-name",
    imageFile: "text-extra-object-name.webp",
    input: { language: "en", scene: electronHook },
  }),
  checkCase({
    expected: false,
    id: "extra-callouts",
    imageFile: "text-extra-callouts.webp",
    input: { language: "en", scene: qubitDevice },
  }),
  checkCase({
    expected: false,
    id: "photo",
    imageFile: "offstyle-photo-microwave.webp",
    input: { ...microwave, scene: { ...microwave.scene, labels: [] } },
  }),
  checkCase({
    expected: false,
    id: "infographic",
    imageFile: "offstyle-infographic-water-cycle.webp",
    input: {
      language: "en",
      scene: {
        focalObject: "water evaporating from a lake and rising into a cloud",
        labels: [],
        layout: "single",
        motion: "dashed arrows rise from the lake to the cloud",
        relation: null,
        supportingObjects: ["a small sun"],
      },
    },
  }),
];
