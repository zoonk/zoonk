export type BestDayScore = { correctAnswers: number; dayOfWeek: number; incorrectAnswers: number };

/**
 * Captures the durable progress facts needed to preview completion milestones.
 * The contract is app-agnostic so every player surface can evaluate the same
 * completion against the same pre-completion state.
 */
export type PlayerProgressSnapshot = {
  bestDayScores: BestDayScore[] | null;
  currentEnergy: number;
  fullEnergyDays: number;
  highestPreviousDailyBrainPower: number;
  learningDays: number;
  todayBrainPower: number;
  todayCompletedLessons: number;
  todayEnergyAtEnd: number | null;
  todayInteractiveLessons: number;
  totalLearningSeconds: number;
};

/**
 * Adds the aggregate Brain Power needed to initialize the player's separate
 * level state without duplicating it inside the locally advanced milestone
 * snapshot.
 */
export type PlayerInitialProgress = {
  progressSnapshot: PlayerProgressSnapshot;
  totalBrainPower: number;
};
