/** "1", "1.1", "5.7.": a notice's item number, never a year opening a topic ("2026 in numbers"). */
const ITEM_NUMBER = /^\s*(?<number>\d{1,3}(?:\.\d{1,3})*)\.?\s+(?<text>\S.*)$/su;

/** A sub-item's code some notices write instead of a number: ENEM's "H18 - Identify…". */
const ITEM_CODE = /^\s*(?<number>[A-Z]{1,3}\d{1,3})\s*[-–—:]\s+(?<text>\S.*)$/su;

type NumberedTopic = { depth: number; number: string | null; text: string };

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

export function toTopicWords(name: string): string {
  return splitTopicNumber(name).text;
}

export type TopicGroup<Topic extends { name: string }> = {
  children: { depth: number; number: string | null; text: string; topic: Topic }[];
  number: string | null;
  text: string;
  topic: Topic;
};

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
