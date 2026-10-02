/**
 * The checked diagrams a labeled diagram can use, with the parts each drawing names. The player
 * draws every diagram with exactly these parts, the validator rejects any other id, and the
 * writer's template description lists them, so a label can only point at a part that is drawn.
 */
const activityDiagrams = {
  "animal-cell": {
    parts: [
      "cell-membrane",
      "cytoplasm",
      "nucleus",
      "nucleolus",
      "mitochondrion",
      "rough-endoplasmic-reticulum",
      "golgi-apparatus",
      "ribosome",
      "lysosome",
    ],
    title: "An animal cell as seen under a microscope",
  },
  atom: {
    parts: ["nucleus", "proton", "neutron", "electron", "electron-shell"],
    title: "An atom in the shell (Bohr) model",
  },
  "digestive-system": {
    parts: [
      "mouth",
      "esophagus",
      "stomach",
      "liver",
      "gallbladder",
      "pancreas",
      "small-intestine",
      "large-intestine",
      "rectum",
    ],
    title: "The human digestive system, front view",
  },
  "earth-layers": {
    parts: ["crust", "mantle", "outer-core", "inner-core"],
    title: "The layers of the Earth, cut open",
  },
  "electric-circuit": {
    parts: ["battery", "switch", "bulb", "resistor", "wire"],
    title: "A simple series circuit with a battery, switch, bulb and resistor",
  },
  flower: {
    parts: [
      "petal",
      "sepal",
      "anther",
      "filament",
      "stigma",
      "style",
      "ovary",
      "receptacle",
      "stem",
    ],
    title: "A flower cut in half to show its parts",
  },
  "human-ear": {
    parts: [
      "pinna",
      "ear-canal",
      "eardrum",
      "ossicles",
      "semicircular-canals",
      "cochlea",
      "auditory-nerve",
      "eustachian-tube",
    ],
    title: "The human ear: outer, middle and inner ear",
  },
  "human-eye": {
    parts: ["cornea", "iris", "pupil", "lens", "retina", "optic-nerve", "sclera", "vitreous-humor"],
    title: "The human eye from the side, light entering on the left",
  },
  "human-heart": {
    parts: [
      "right-atrium",
      "left-atrium",
      "right-ventricle",
      "left-ventricle",
      "aorta",
      "pulmonary-artery",
      "superior-vena-cava",
      "inferior-vena-cava",
      "pulmonary-veins",
      "septum",
    ],
    title: "The human heart seen from the front, so its right side is on the viewer's left",
  },
  insect: {
    parts: ["head", "thorax", "abdomen", "antenna", "compound-eye", "wing", "leg"],
    title: "An insect's body from above",
  },
  "leaf-cross-section": {
    parts: [
      "cuticle",
      "upper-epidermis",
      "palisade-mesophyll",
      "spongy-mesophyll",
      "lower-epidermis",
      "stoma",
      "guard-cell",
      "vein",
    ],
    title: "A cross-section of a leaf",
  },
  neuron: {
    parts: [
      "dendrite",
      "cell-body",
      "nucleus",
      "axon",
      "myelin-sheath",
      "node-of-ranvier",
      "axon-terminal",
    ],
    title: "A motor neuron",
  },
  plant: {
    parts: ["roots", "stem", "leaf", "flower", "bud", "fruit"],
    title: "A flowering plant from roots to flower",
  },
  "plant-cell": {
    parts: [
      "cell-wall",
      "cell-membrane",
      "cytoplasm",
      "nucleus",
      "chloroplast",
      "central-vacuole",
      "mitochondrion",
    ],
    title: "A plant cell as seen under a microscope",
  },
  "respiratory-system": {
    parts: ["nasal-cavity", "larynx", "trachea", "bronchus", "bronchiole", "lung", "diaphragm"],
    title: "The human respiratory system, front view",
  },
  volcano: {
    parts: ["magma-chamber", "main-vent", "crater", "lava-flow", "ash-cloud", "side-vent", "crust"],
    title: "A volcano cut open during an eruption",
  },
  "water-cycle": {
    parts: [
      "evaporation",
      "transpiration",
      "condensation",
      "precipitation",
      "surface-runoff",
      "infiltration",
      "groundwater",
    ],
    title: "The water cycle over land and sea",
  },
} as const satisfies Record<string, { parts: readonly string[]; title: string }>;

export type DiagramId = keyof typeof activityDiagrams;

export type DiagramPartId<TId extends DiagramId> = (typeof activityDiagrams)[TId]["parts"][number];

const diagramIds: ReadonlySet<string> = new Set(Object.keys(activityDiagrams));

export function isDiagramId(id: string): id is DiagramId {
  return diagramIds.has(id);
}

/** The part ids a checked diagram draws, or null when there is no diagram with that id. */
export function getDiagramParts(id: string): readonly string[] | null {
  return isDiagramId(id) ? activityDiagrams[id].parts : null;
}

/** Every diagram with its part ids, one per line, for the writer's template description. */
export function describeDiagrams(): string {
  return Object.entries(activityDiagrams)
    .map(([id, diagram]) => `${id} (${diagram.title}): ${diagram.parts.join(", ")}`)
    .join("\n");
}
