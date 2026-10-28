/** Without the day's bonus it paid: the missions show that beside it. */
export function getOwnBrainPower(completion: {
  brainPower: number;
  fullMeal: { bonus: number; paid: boolean };
}): number {
  return completion.brainPower - (completion.fullMeal.paid ? completion.fullMeal.bonus : 0);
}
