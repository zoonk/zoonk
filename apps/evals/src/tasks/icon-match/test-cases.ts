import { type TestCase } from "@/lib/types";
import { type IconCandidate, type IconMatchParams } from "@zoonk/ai/tasks/icons/match";

export type IconMatchExpected = { reuse: (string | null)[] };

type IconMatchInput = Pick<IconMatchParams, "needs">;

function icon(id: string, name: string, tags: string[], description: string): IconCandidate {
  return { description, id, name, tags };
}

const SCALE = icon(
  "lib-scale",
  "balance scale",
  ["justice", "scales", "weigh"],
  "A brass balance scale with two pans level",
);

const PIGGY = icon(
  "lib-piggy",
  "piggy bank",
  ["savings", "coin", "save"],
  "A pink piggy bank with a coin going into its slot",
);

const COIN = icon("lib-coin", "coin", ["money", "cent"], "One gold coin seen from the front");

const COINS = icon(
  "lib-coins",
  "stack of coins",
  ["money", "savings"],
  "A short stack of gold coins",
);

const DROP = icon("lib-drop", "water drop", ["water", "liquid", "rain"], "One blue water drop");

const BUILDING = icon(
  "lib-building",
  "office building",
  ["company", "business"],
  "A tall glass office building",
);

const HOUSE = icon("lib-house", "house", ["home", "family"], "A small house with a red roof");

const BULB = icon(
  "lib-bulb",
  "light bulb",
  ["idea", "electricity", "lamp"],
  "A glowing light bulb",
);

const METER = icon(
  "lib-meter",
  "electricity meter",
  ["power", "utility bill", "energy"],
  "A household electricity meter with a dial",
);

const LEAF = icon(
  "lib-leaf",
  "green leaf",
  ["plant", "nature"],
  "One green leaf with visible veins",
);

const TREE = icon("lib-tree", "tree", ["plant", "forest"], "A round green tree");

const MAGNET = icon(
  "lib-magnet",
  "horseshoe magnet",
  ["magnetism", "attract"],
  "A red horseshoe magnet",
);

function need(name: string, searchWords: string[], description: string) {
  return { description, name, searchWords };
}

export const TEST_CASES: TestCase<IconMatchExpected, IconMatchInput>[] = [
  {
    expected: { reuse: ["lib-scale", null, "lib-drop"] },
    id: "en-same-thing-other-name",
    language: "en",
    userInput: {
      needs: [
        {
          candidates: [SCALE, BUILDING],
          need: need(
            "scales of justice",
            ["law", "justice"],
            "A balance scale, the symbol of justice",
          ),
          usedFor: "a screen: a judge must weigh both sides before deciding",
        },
        {
          candidates: [PIGGY, COINS],
          need: need("savings jar", ["savings", "jar"], "A glass jar with coins inside"),
          usedFor: "a screen: Maya keeps her spare change in a jar on the shelf",
        },
        {
          candidates: [DROP],
          need: need("water droplet", ["water", "drop"], "A single drop of water"),
          usedFor: "the lesson map's idea: water moves up from the roots",
        },
      ],
    },
  },
  {
    expected: { reuse: [null, null, "lib-coins"] },
    id: "en-part-variant-or-generic",
    language: "en",
    userInput: {
      needs: [
        {
          candidates: [COIN, PIGGY],
          need: need("stack of coins", ["money", "coins"], "A tall stack of coins"),
          usedFor: "a screen: the interest piles up year after year",
        },
        {
          candidates: [BUILDING, HOUSE],
          need: need(
            "city hall",
            ["government", "town hall", "building"],
            "A city hall with columns and a clock",
          ),
          usedFor: "a screen: the mayor's office sets the local tax",
        },
        {
          candidates: [COINS, COIN],
          need: need("pile of coins", ["money", "savings"], "A pile of gold coins"),
          usedFor: "a screen: everything the business keeps adds up",
        },
      ],
    },
  },
  {
    expected: { reuse: ["lib-meter", null] },
    id: "pt-conta-de-luz",
    language: "pt",
    userInput: {
      needs: [
        {
          candidates: [BULB, METER],
          need: need(
            "electric meter",
            ["electricity", "power", "utility"],
            "A home electricity meter",
          ),
          usedFor:
            "a screen: Você gasta R$ 150,00 para pagar a luz de casa, um serviço necessário.",
        },
        {
          candidates: [BULB],
          need: need(
            "power outlet",
            ["socket", "plug", "electricity"],
            "A wall power outlet with two holes",
          ),
          usedFor: "a screen: A tomada fornece energia para a geladeira da cozinha.",
        },
      ],
    },
  },
  {
    expected: { reuse: [null, "lib-tree", null] },
    id: "pt-plantas-e-imas",
    language: "pt",
    userInput: {
      needs: [
        {
          candidates: [LEAF, TREE],
          need: need("cactus", ["plant", "desert"], "A green cactus in a small pot"),
          usedFor: "a screen: O cacto guarda água no caule para aguentar a seca.",
        },
        {
          candidates: [TREE, LEAF],
          need: need("tree", ["plant", "forest"], "A leafy tree"),
          usedFor: "the lesson map's idea: As árvores tiram carbono do ar.",
        },
        {
          candidates: [MAGNET],
          need: need(
            "compass",
            ["north", "navigation", "magnet"],
            "A round compass with a red needle",
          ),
          usedFor: "a screen: A agulha da bússola aponta para o norte magnético.",
        },
      ],
    },
  },
];
