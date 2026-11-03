import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { useExtracted } from "next-intl";

type Card = { text: string };
type Group = { label: string };

export function useSortAnnouncements() {
  const t = useExtracted();
  const spoken = useSpokenText();

  return {
    placed: (card: Card, group: Group) =>
      t("{item} is in {group}.", {
        group: spoken.inline(group.label),
        item: spoken.inline(card.text),
      }),
    placedWithNext: ({ card, group, next }: { card: Card; group: Group; next: Card }) =>
      t({
        description:
          "Read by screen readers after a card is sorted; {next} is the card to sort now.",
        message: "{item} is in {group}. Next: {next}.",
        values: {
          group: spoken.inline(group.label),
          item: spoken.inline(card.text),
          next: spoken.inline(next.text),
        },
      }),
    tookBack: (card: Card) =>
      t({
        description: "Read by screen readers after Undo: this card is back to be sorted again.",
        message: "Took back {item}.",
        values: { item: spoken.inline(card.text) },
      }),
  };
}
