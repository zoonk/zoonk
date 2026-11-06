import { type ImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import { TEST_CASES as IMAGE_CASES } from "../lesson-image/test-cases";

export type ImageCheckCaseInput = {
  alt?: string;
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
  input: { alt?: string; language: string; scene: ImageScene };
}) {
  return { expected: { passed: expected }, id, userInput: { imageFile, ...input } };
}

function numberedScene(focalObject: string, parts: readonly string[]): ImageScene {
  return {
    focalObject,
    labels: parts.map((part, index) => ({
      target: `pointing at the ${part}`,
      text: String(index + 1),
    })),
    layout: "single",
    motion: null,
    relation: null,
    supportingObjects: [],
  };
}

const numberedAnimalCell = numberedScene(
  "an animal cell as seen under a microscope, cut open: the cell membrane around it, the nucleus with its nucleolus, several mitochondria, the Golgi apparatus and the rough endoplasmic reticulum",
  [
    "cell membrane",
    "nucleus",
    "nucleolus",
    "mitochondrion",
    "Golgi apparatus",
    "rough endoplasmic reticulum",
  ],
);

const numberedFlower = numberedScene(
  "a flower cut in half lengthwise to show its petals, sepals, stamens with anthers, the stigma on top of the style and the ovary at the base",
  ["petal", "sepal", "anther", "stigma", "ovary"],
);

const numberedBicycle = numberedScene("a bicycle seen from the side", [
  "handlebars",
  "saddle",
  "chain",
  "pedal",
  "front wheel",
  "frame",
]);

const wallAndMembrane: ImageScene = {
  focalObject:
    "a simplified plant cell outline with a thick green outer hexagonal boundary and a thin inner line running just inside it with a small gap in between",
  labels: [
    { target: "at a pointer line touching the thick outer boundary", text: "A" },
    { target: "at a pointer line touching the thin inner line", text: "B" },
  ],
  layout: "single",
  motion: null,
  relation: null,
  supportingObjects: [],
};

const animalCellLetters: ImageScene = {
  focalObject:
    "a simplified cutaway view of a round animal cell showing a large central spherical nucleus",
  labels: [
    { target: "pointing to the oval mitochondrion with wavy internal folds", text: "A" },
    { target: "pointing to the dotted folded membranes near the nucleus", text: "B" },
    { target: "pointing to the stack of curved flattened sacs", text: "C" },
  ],
  layout: "single",
  motion: null,
  relation:
    "The dotted folded membranes sit directly next to the nucleus, while the stacked smooth sacs and the oval mitochondrion are positioned separately in the surrounding cytoplasm",
  supportingObjects: [
    "an oval mitochondrion with internal folds, a folded membrane sheet studded with small surface dots adjacent to the nucleus, and a stack of smooth curved flattened sacs",
  ],
};

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

const officeSalary: ImageScene = {
  focalObject:
    "a man sitting at an office desk with a laptop, receiving an envelope with banknotes from a coworker's hand",
  labels: [],
  layout: "single",
  motion: null,
  relation: null,
  supportingObjects: ["a wall calendar behind him"],
};

const officeRepairs: ImageScene = {
  focalObject: "a man sitting at an office desk in front of a monitor, typing on a keyboard",
  labels: [],
  layout: "single",
  motion: null,
  relation: "a toolbox and an opened computer tower rest on a low table beside the desk",
  supportingObjects: ["a small side table holding an open computer tower and a toolbox"],
};

const counterRepairs: ImageScene = {
  focalObject:
    "a repairman in an apron behind a wooden counter, handing a repaired yellow toaster to a customer whose hands reach in from the right",
  labels: [],
  layout: "single",
  motion: null,
  relation: "a pegboard with a screwdriver and a wrench hangs on the wall behind him",
  supportingObjects: ["a pegboard with a screwdriver and a wrench"],
};

const carbonShells: ImageScene = {
  focalObject:
    "a simplified carbon atom diagram with a small solid center and two concentric circular rings, containing two small dots on the inner ring and four small dots on the outer ring",
  labels: [
    { target: "above the whole atom diagram", text: "carbono" },
    { target: "next to the center circle", text: "centro" },
    { target: "next to one dot on the outer ring", text: "elétron" },
  ],
  layout: "single",
  motion: null,
  relation: null,
  supportingObjects: [],
};

const discount = sceneOf("discount-pt");
const electronCloud = sceneOf("electron-cloud-en");
const microwave = sceneOf("microwave-en");

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
  checkCase({
    expected: true,
    id: "question-letters",
    imageFile: "flare-question-animal-cell-letters.webp",
    input: { language: "pt", scene: animalCellLetters },
  }),
  checkCase({
    expected: false,
    id: "question-pointer-on-wrong-part",
    imageFile: "flare-question-wall-membrane-wrong-pointer.webp",
    input: { language: "pt", scene: wallAndMembrane },
  }),
  checkCase({
    expected: true,
    id: "numbered-animal-cell",
    imageFile: "numbered-animal-cell.webp",
    input: { language: "en", scene: numberedAnimalCell },
  }),
  checkCase({
    expected: true,
    id: "numbered-flower",
    imageFile: "numbered-flower.webp",
    input: { language: "en", scene: numberedFlower },
  }),
  checkCase({
    expected: true,
    id: "numbered-bicycle-tire",
    imageFile: "numbered-bicycle.webp",
    input: { language: "en", scene: numberedBicycle },
  }),
  checkCase({
    expected: false,
    id: "two-scenes-for-one",
    imageFile: "flare-two-scenes-salary.webp",
    input: { language: "pt", scene: officeSalary },
  }),
  checkCase({
    expected: false,
    id: "repair-counter-for-office",
    imageFile: "flare-repair-counter.webp",
    input: { language: "pt", scene: officeRepairs },
  }),
  checkCase({
    expected: true,
    id: "repair-counter-matches-alt",
    imageFile: "flare-repair-counter.webp",
    input: {
      alt: "Igor entrega uma torradeira consertada a um cliente no balcão da oficina.",
      language: "pt",
      scene: counterRepairs,
    },
  }),
  checkCase({
    expected: false,
    id: "repair-counter-contradicts-alt",
    imageFile: "flare-repair-counter.webp",
    input: {
      alt: "Igor recebe um envelope de salário sentado à mesa do escritório.",
      language: "pt",
      scene: counterRepairs,
    },
  }),
  checkCase({
    expected: false,
    id: "repair-counter-drops-alt-moment",
    imageFile: "flare-repair-counter.webp",
    input: {
      alt: "Igor entrega uma torradeira consertada no balcão e, à noite, anota o valor recebido num caderno em casa.",
      language: "pt",
      scene: counterRepairs,
    },
  }),
  checkCase({
    expected: false,
    id: "carbon-extra-outer-electron",
    imageFile: "flare-carbon-extra-electron-pt.webp",
    input: {
      alt: "Átomo de carbono com centro pequeno, dois pontos na faixa de dentro e quatro na faixa de fora, com os rótulos centro, elétron e carbono.",
      language: "pt",
      scene: carbonShells,
    },
  }),
];
