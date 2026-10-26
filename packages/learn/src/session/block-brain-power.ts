/**
 * The Brain Power a block earned on its own: the day's bonus it paid, when it did, is the
 * missions' to show, beside it.
 */
export function getOwnBrainPower(completion: {
  brainPower: number;
  fullMeal: { bonus: number; paid: boolean };
}): number {
  return completion.brainPower - (completion.fullMeal.paid ? completion.fullMeal.bonus : 0);
}
