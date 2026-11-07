import { segmentLearnerWords, segmentWords } from "@zoonk/utils/string";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { keepOtherArrangeOrders } from "./arrange-word-orders";
import {
  buildAcceptedArrangeWordSequences,
  matchesAcceptedArrangeWords,
  normalizeArrangeWord,
  segmentArrangeWords,
} from "./arrange-words-answers";

const ITALIAN = "Quando pioveva l'autobus è arrivato";

describe(keepOtherArrangeOrders, () => {
  it("keeps an order of the same tiles", () => {
    expect(
      keepOtherArrangeOrders({
        kind: "reading",
        orders: ["Quando pioveva è arrivato l'autobus"],
        text: ITALIAN,
      }),
    ).toStrictEqual(["Quando pioveva è arrivato l'autobus"]);
  });

  it("ignores case and punctuation the way the screen compares tiles", () => {
    expect(
      keepOtherArrangeOrders({
        kind: "reading",
        orders: ["l'autobus è arrivato, quando pioveva"],
        text: ITALIAN,
      }),
    ).toStrictEqual(["l'autobus è arrivato Quando pioveva"]);
  });

  it("drops the text's own order and repeated orders", () => {
    expect(
      keepOtherArrangeOrders({
        kind: "reading",
        orders: [
          "quando pioveva l'autobus è arrivato",
          "Quando pioveva è arrivato l'autobus",
          "quando pioveva, è arrivato l'autobus",
        ],
        text: ITALIAN,
      }),
    ).toStrictEqual(["Quando pioveva è arrivato l'autobus"]);
  });

  it("drops orders with a missing, extra or different word", () => {
    expect(
      keepOtherArrangeOrders({
        kind: "reading",
        orders: [
          "Quando pioveva è arrivato",
          "Quando pioveva è arrivato l'autobus ieri",
          "Quando pioveva è arrivato il autobus",
          "Quando piove è arrivato l'autobus",
        ],
        text: ITALIAN,
      }),
    ).toStrictEqual([]);
  });

  it("drops an order that uses a word twice in place of another", () => {
    expect(
      keepOtherArrangeOrders({
        kind: "reading",
        orders: ["Quando quando pioveva l'autobus è"],
        text: ITALIAN,
      }),
    ).toStrictEqual([]);
  });

  it("builds a listening translation from the phrase tiles its screen shows", () => {
    const [kept] = keepOtherArrangeOrders({
      kind: "listening",
      orders: [
        "毎朝私はコーヒーを飲みます",
        "毎朝 私は コーヒーを 飲みます",
        "私はコーヒーを毎朝飲む",
      ],
      text: "私は毎朝コーヒーを飲みます",
    });

    expect(kept).toBe("毎朝 私は コーヒーを 飲みます");
    expect(segmentLearnerWords(kept!)).toStrictEqual(["毎朝", "私は", "コーヒーを", "飲みます"]);
  });

  it("builds a reading sentence from the word tiles its screen shows", () => {
    const kept = keepOtherArrangeOrders({
      kind: "reading",
      orders: ["毎朝私はコーヒーを飲みます"],
      text: "私は毎朝コーヒーを飲みます",
    });

    expect(kept).toStrictEqual(["毎朝 私 は コーヒー を 飲 み ます"]);

    expect(segmentWords(kept[0]!)).toStrictEqual([
      "毎朝",
      "私",
      "は",
      "コーヒー",
      "を",
      "飲",
      "み",
      "ます",
    ]);
  });

  it("stores Japanese orders using the bank's tiles before grading them", () => {
    const text = "私は毎朝コーヒーを飲みます";

    const orders = keepOtherArrangeOrders({
      kind: "listening",
      orders: ["毎朝 私は コーヒー（を） 飲みます"],
      text,
    });

    const otherOrders = orders.map((order) => segmentLearnerWords(order));
    const accepted = buildAcceptedArrangeWordSequences({ kind: "listening", otherOrders, text });

    expect(otherOrders).toStrictEqual([["毎朝", "私は", "コーヒーを", "飲みます"]]);

    expect(matchesAcceptedArrangeWords(accepted, ["毎朝", "私は", "コーヒーを", "飲みます"])).toBe(
      true,
    );

    expect(
      matchesAcceptedArrangeWords(accepted, ["毎朝", "私は", "コーヒー", "を", "飲みます"]),
    ).toBe(false);
  });

  it("keeps the bank's tile multiset when candidate punctuation changes segmentation", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("reading" as const, "listening" as const),
        fc.constantFrom("コーヒー（を）", "コーヒー(を)", "コーヒーを"),
        (kind, coffee) => {
          const text = "私は毎朝コーヒーを飲みます";

          const bank = segmentArrangeWords({ kind, text })
            .map((word) => normalizeArrangeWord(word))
            .toSorted();

          const orders = keepOtherArrangeOrders({
            kind,
            orders: [`毎朝 私は ${coffee} 飲みます`],
            text,
          });

          expect(orders).toHaveLength(1);

          expect(
            segmentArrangeWords({ kind, text: orders[0]! })
              .map((word) => normalizeArrangeWord(word))
              .toSorted(),
          ).toStrictEqual(bank);
        },
      ),
    );
  });
});
