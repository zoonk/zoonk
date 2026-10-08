/**
 * A syllabus item's own number ("1", "1.1", "5.7."), which a notice writes before its words; a
 * year opening a topic ("2026 em números") isn't one.
 */
const ITEM_NUMBER = /^\s*(?<number>\d{1,3}(?:\.\d{1,3})*)\.?\s+(?<text>\S.*)$/su;

/**
 * A sub-item's code, which some notices write instead of a number under a named item: ENEM's
 * "H18 - Identificar…" under "Competência de área 5 - …".
 */
const ITEM_CODE = /^\s*(?<number>[A-Z]{1,3}\d{1,3})\s*[-–—:]\s+(?<text>\S.*)$/su;

/** A topic split into the notice's own number and its words, and how deep the number nests. */
type NumberedTopic = { depth: number; number: string | null; text: string };

/**
 * The notice's own numbering of a topic ("1.1 Princípios…", or a sub-item's code such as "H18 -"):
 * its number, its words and its depth (0 for "1", 1 for "1.1" or a code), so lists show the
 * notice's hierarchy instead of a second index.
 */
function splitTopicNumber(name: string): NumberedTopic {
  const numbered = ITEM_NUMBER.exec(name)?.groups;

  if (numbered?.number && numbered.text) {
    return {
      depth: numbered.number.split(".").length - 1,
      number: numbered.number,
      text: numbered.text,
    };
  }

  const coded = ITEM_CODE.exec(name)?.groups;

  if (coded?.number && coded.text) {
    return { depth: 1, number: coded.number, text: coded.text };
  }

  return { depth: 0, number: null, text: name };
}

/**
 * One item of the notice's outline and the items it numbers under it ("1" and its "1.1", "1.2"),
 * each with its words and, apart, the notice's own number, which screens show quietly beside them
 * so a learner can check the outline against the notice item by item.
 */
export type TopicGroup<Topic extends { name: string }> = {
  children: { depth: number; number: string | null; text: string; topic: Topic }[];
  /** The notice's own number or code for it ("5.7", "H18"), to check it against the notice. */
  number: string | null;
  text: string;
  topic: Topic;
};

/**
 * The notice's topics as its own outline: each top-level item with the items numbered under it, in
 * the notice's order. Topics the notice doesn't number are each an item of their own, and a list
 * that starts below the top ("1.1", "1.2") takes its first level as the top.
 */
export function groupTopics<Topic extends { name: string }>(
  topics: readonly Topic[],
): TopicGroup<Topic>[] {
  const split = topics.map((topic) => ({ ...splitTopicNumber(topic.name), topic }));
  const top = Math.min(...split.map((item) => item.depth));

  const heads = split.flatMap((item, index) => (index === 0 || item.depth <= top ? [index] : []));

  return heads.flatMap((start, position) => {
    const head = split[start];
    const children = split.slice(start + 1, heads[position + 1] ?? split.length);

    return head
      ? [
          {
            children: children.map((item) => ({
              depth: item.depth - top,
              number: item.number,
              text: item.text,
              topic: item.topic,
            })),
            number: head.number,
            text: head.text,
            topic: head.topic,
          },
        ]
      : [];
  });
}
