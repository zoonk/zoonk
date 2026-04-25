/**
 * AI tasks generate option text and feedback, but the stored player contract
 * needs stable option IDs so shuffled options can be answered and validated by
 * identity instead of by render order or display text.
 */
export function addOptionIds<Option extends object>({
  options,
  prefix = "option",
}: {
  options: readonly Option[];
  prefix?: string;
}): (Option & { id: string })[] {
  return options.map((option, index) => ({ ...option, id: `${prefix}-${index + 1}` }));
}
