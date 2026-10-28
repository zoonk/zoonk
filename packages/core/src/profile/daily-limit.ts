export const MIN_DAILY_LIMIT_MINUTES = 10;
export const MAX_DAILY_LIMIT_MINUTES = 480;

const DAILY_LIMIT_CHOICE_MINUTES = {
  halfHour: 30,
  hour: 60,
  hourAndHalf: 90,
  quarterHour: 15,
  threeHours: 180,
  threeQuarters: 45,
  twoHours: 120,
};

export const DAILY_LIMIT_CHOICES = Object.values(DAILY_LIMIT_CHOICE_MINUTES).toSorted(
  (first, second) => first - second,
);
