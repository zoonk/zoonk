import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";

type ChapterLessons = NonNullable<WriteLessonDraftParams["chapterLessons"]>;

function screen(
  kind: LessonSpec["screens"][number]["kind"],
  brief: string,
  visual: string | null = null,
): LessonSpec["screens"][number] {
  return { activityTemplate: null, brief, kind, skills: kind === "hook" ? [] : [0], visual };
}

/**
 * A lesson planned in parallel with the rest of its chapter (stock market overview, 27 Sep 2026):
 * its plan reuses the $20, $21 and $19 prices an earlier lesson of the chapter already used, so
 * the writer has to pick new numbers and build on what the earlier lessons taught.
 */
export const PRICE_IMPACT_SPEC: LessonSpec = {
  canDo: "Explain why a large order may trade at several prices",
  description:
    "See how a large buy or sell order can use up shares at one price and reach a less favorable price.",
  estimatedMinutes: 3,
  screens: [
    screen(
      "hook",
      "You want to buy 25 shares, and 10 are offered at $20 each. Guess: will all 25 cost $20 per share? The guess does not count.",
    ),
    screen(
      "explanation",
      "Show that the $20 offer covers only 10 shares, like a store shelf with just 10 items at that price. Buying more shares requires another offer.",
      "A shelf-like row of 10 shares labeled $20 each, followed by a separate row of 20 shares labeled $21 each.",
    ),
    screen(
      "explanation",
      "A buy order for 25 shares takes the 10 available at $20, then 15 of the shares offered at $21. The order reaches a higher price because it uses up the shares at $20.",
      "The 25-share order filling the $20 row first, then part of the $21 row.",
    ),
    screen(
      "check",
      "Ask which order reaches the $21 offer: a buy order for 5 shares or one for 25 shares. Include the tempting wrong answer that both orders pay $20 for every share.",
    ),
    screen(
      "explanation",
      "The direction reverses for a large sale: if buyers want 8 shares at $19 and 20 more at $18, selling 12 shares reaches the lower price. The seller gets $19 for the first 8 and $18 for the next 4.",
      "Two rows of buyers, labeled 8 shares at $19 and 20 shares at $18, with a 12-share sale reaching both rows.",
    ),
    screen(
      "check",
      "Ask why selling 12 shares does not get $19 for every share. Include the tempting wrong answer that the first buyer's price applies to the entire order.",
    ),
    screen(
      "application",
      "In a stock account, you see 10 shares offered at $20 and 20 at $21, then place a buy order for 25. Ask which shares would trade at each price and why the later shares cost more.",
    ),
  ],
  skills: [
    {
      description:
        "Explain how an order can use up shares available at one price and trade the rest at a less favorable price.",
      example: "A buy order for 25 shares takes 10 at $20 each and 15 at $21 each.",
      hard: false,
      name: "Explain the price impact of an order",
      topic: "Price impact",
      useCase:
        "When placing a stock order, understand why not every share may trade at the first price shown.",
    },
  ],
  supportMode: "explanationFirst",
  title: "Large orders and price impact",
};

/** The chapter's other lessons as production passes them, with the examples of their plans. */
export const PRICE_IMPACT_CHAPTER_LESSONS: ChapterLessons = [
  {
    canDo: "Explain why a stock's next trade may have a different price",
    examples: [
      "One share trades for $20; later, a buyer offers $21 and a seller accepts, so the next trade is at $21.",
      "A stock traded for $20 a minute ago, then for $21. Ask learners to guess what might have changed; the guess does not count.",
      "The last trade was $20. Buyers now want to pay only $19, and a seller accepts. Ask for the next trade price; include $20 as the tempting answer because it was the last price.",
    ],
    ideas: [
      "Explain that a stock's next trade price can change when buyers and sellers change the prices they are willing to agree on.",
    ],
    order: "before",
    title: "Why stock prices change",
  },
  {
    canDo: "Recognize when a stock may be hard to trade",
    examples: [
      "Stock A has several people ready to buy and sell today, while Stock B has one ready seller and no ready buyer.",
      "You want to sell a stock today, but no one is ready to buy it. Ask learners to guess what might happen to their sale.",
    ],
    ideas: [
      "Market liquidity is how easy it is to trade a stock when willing buyers and sellers are available.",
    ],
    order: "before",
    title: "Market liquidity",
  },
  {
    canDo: "Spot a trading cost in the buy-sell price gap",
    examples: [
      "A share costs $20.10 to buy but sells for $20.00, leaving a 10-cent spread.",
      "Show two stocks: one costs $30.05 to buy and sells for $30.00; the other costs $30.20 to buy and sells for $30.00. Ask which has the wider spread.",
    ],
    ideas: [
      "Identify the gap between the available buying and selling prices and recognize it as a cost of trading immediately.",
    ],
    order: "before",
    title: "Buying and selling price spreads",
  },
  {
    canDo: "Imagine how this chapter's ideas play out",
    order: "after",
    title: "What if? Prices and trading costs",
  },
];
