import { randomUUID } from "node:crypto";
import { type WarmUp, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

type WarmUpCardDraft = {
  options: { correct: boolean; text: string }[];
  question: string;
  reveal: string;
};

const BEEKEEPING_CARDS: WarmUpCardDraft[] = [
  {
    options: [
      { correct: false, text: "To put the bees to sleep" },
      { correct: true, text: "To hide the bees' alarm scent" },
      { correct: false, text: "To warm up the hive" },
    ],
    question: "Why do beekeepers puff smoke into a hive before opening it?",
    reveal: "Smoke masks the alarm scent that guard bees release, so fewer bees join in.",
  },
  {
    options: [
      { correct: false, text: "2" },
      { correct: true, text: "5" },
      { correct: false, text: "8" },
    ],
    question: "How many eyes does a honey bee have?",
    reveal: "Five: two big compound eyes on the sides, and three small ones on top.",
  },
  {
    options: [
      { correct: false, text: "A summer worker" },
      { correct: true, text: "A queen" },
    ],
    question: "Who lives longer?",
    reveal: "The queen, by far: she can live for several years.",
  },
];

/** A ready deck unless `status` says otherwise. */
export async function warmUpFixture(attrs: FixtureAttrs<WarmUp, "cards"> = {}) {
  return prisma.warmUp.create({
    data: {
      cards: BEEKEEPING_CARDS.map((card) => ({
        ...card,
        id: randomUUID(),
        options: card.options.map((option) => ({ ...option, id: randomUUID() })),
      })),
      identityKey: `learn::test-${randomUUID()}`,
      language: "en",
      runId: `test-run-${randomUUID()}`,
      status: "ready",
      ...attrs,
    },
  });
}
