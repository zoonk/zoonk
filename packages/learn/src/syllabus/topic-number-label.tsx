export function TopicNumber({ number }: { number: string | null }) {
  if (!number) {
    return null;
  }

  return (
    <>
      <span className="text-muted-foreground font-mono text-[0.9em] tabular-nums">
        {number}
      </span>{" "}
    </>
  );
}
