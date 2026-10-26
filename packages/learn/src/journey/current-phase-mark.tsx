/** The current phase's quiet dot; the next chapter carries the learner's mark. */
export function CurrentPhaseMark() {
  return (
    <span
      aria-hidden="true"
      className="bg-foreground ring-foreground/15 size-2.5 rounded-full ring-4"
    />
  );
}
