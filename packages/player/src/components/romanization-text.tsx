/** How a word or sentence in a script the learner can't read yet sounds, in quiet small type. */
export function RomanizationText({ children }: { children?: string | null }) {
  if (!children) {
    return null;
  }

  return <span className="text-muted-foreground text-xs font-normal">{children}</span>;
}
