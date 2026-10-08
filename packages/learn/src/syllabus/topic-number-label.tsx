/**
 * The notice's own number or code before an item's words ("5.7", "H18"), quiet, and a space so it
 * reads apart from the words.
 */
export function TopicNumber({ number }: { number: string | null }) {
  if (!number) {
    return null;
  }

  return (
    <>
      <span className="text-muted-foreground tabular-nums">{number}</span>{" "}
    </>
  );
}
