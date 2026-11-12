function isWrongOption(option: unknown): boolean {
  return (
    typeof option === "object" &&
    option !== null &&
    "isCorrect" in option &&
    option.isCorrect === false
  );
}

/**
 * Drops wrong options from the end until a question holds as many as its screen shows. Which
 * options are right is the model's call, so with too many right ones nothing is dropped and the
 * question's own check reports it.
 */
export function fitOptions<OPTION>(options: readonly OPTION[], max: number): OPTION[] {
  const surplus = options.length - max;

  if (surplus <= 0) {
    return [...options];
  }

  const dropped = new Set(
    options.flatMap((option, index) => (isWrongOption(option) ? [index] : [])).slice(-surplus),
  );

  return dropped.size === surplus
    ? options.filter((_, index) => !dropped.has(index))
    : [...options];
}
