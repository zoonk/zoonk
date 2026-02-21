function splitHighlight(
  text: string,
  highlight: string,
): { before: string; match: string | null; after: string } {
  if (!highlight) {
    return { after: "", before: text, match: null };
  }

  const index = text.indexOf(highlight);

  if (index === -1) {
    return { after: "", before: text, match: null };
  }

  return {
    after: text.slice(index + highlight.length),
    before: text.slice(0, index),
    match: highlight,
  };
}

export function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  const { after, before, match } = splitHighlight(text, highlight);

  if (!match) {
    return <span>{text}</span>;
  }

  return (
    <>
      {before}
      <span className="bg-primary/10 text-primary rounded-sm px-1 py-0.5 font-semibold">
        {match}
      </span>
      {after}
    </>
  );
}
