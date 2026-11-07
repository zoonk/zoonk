import { type ReminderMessage } from "@zoonk/core/reminders/message";
import { getExtracted } from "next-intl/server";

export type ReminderText = { body: string; title: string };

/** Titles name the goal after a colon, so they read well whatever its title says. */
export async function loadReminderWords(locale: string) {
  const t = await getExtracted({ locale });

  return {
    bodies: {
      exam: [
        (minutes: number) =>
          t(
            "{minutes, plural, one {# minute} other {# minutes}} of exam prep on your plan today.",
            { minutes },
          ),
        (minutes: number) =>
          t("Today's exam prep: {minutes, plural, one {# minute} other {# minutes}}.", { minutes }),
        (minutes: number) =>
          t(
            "{minutes, plural, one {# minute} other {# minutes}} today moves your exam prep forward.",
            { minutes },
          ),
      ],
      oneGoal: [
        (minutes: number) =>
          t("{minutes, plural, one {# minute} other {# minutes}} on your plan today.", { minutes }),
        (minutes: number) =>
          t("Today's plan has {minutes, plural, one {# minute} other {# minutes}} for it.", {
            minutes,
          }),
        (minutes: number) =>
          t("{minutes, plural, one {# minute} other {# minutes}} today keeps your plan on track.", {
            minutes,
          }),
      ],
      partlyDone: [
        (left: number, done: number) =>
          t(
            "{left, plural, one {# minute} other {# minutes}} left today. You've already done {done, plural, one {# minute} other {# minutes}}.",
            { done, left },
          ),
        (left: number, done: number) =>
          t(
            "You've done {done, plural, one {# minute} other {# minutes}} today. {left, plural, one {# minute} other {# minutes}} to go.",
            { done, left },
          ),
        (left: number) =>
          t("{left, plural, one {# more minute} other {# more minutes}} finishes today's plan.", {
            left,
          }),
      ],
      severalGoals: [
        (minutes: number, others: number) =>
          t(
            "{minutes, plural, one {# minute} other {# minutes}} today, then {others, plural, one {# more goal} other {# more goals}}.",
            { minutes, others },
          ),
        (minutes: number, others: number) =>
          t(
            "Start with {minutes, plural, one {# minute} other {# minutes}}. {others, plural, one {# other goal is} other {# other goals are}} on today's plan too.",
            { minutes, others },
          ),
        (minutes: number, others: number) =>
          t(
            "{minutes, plural, one {# minute} other {# minutes}} for this one, and {others, plural, one {# more goal} other {# more goals}} after it.",
            { minutes, others },
          ),
      ],
    },
    email: {
      open: t("Open today's plan"),
      settings: t("Change reminder settings"),
      unsubscribe: t("Turn off email reminders"),
      why: t("You get this because you turned on study reminders in Zoonk."),
    },
    titles: [
      (goal: string) => t("Next up: {goal}", { goal }),
      (goal: string) => t("Today's study: {goal}", { goal }),
      (goal: string) => t("Time to study: {goal}", { goal }),
      (goal: string) => t("Ready when you are: {goal}", { goal }),
      (goal: string) => t("Still on today: {goal}", { goal }),
      (goal: string) => t("Your study time: {goal}", { goal }),
      (goal: string) => t("On your plan today: {goal}", { goal }),
    ],
  };
}

export type ReminderWords = Awaited<ReturnType<typeof loadReminderWords>>;

function getBody({ message, words }: { message: ReminderMessage; words: ReminderWords }) {
  const { bodyVariant, minutesDone, minutesLeft, otherGoals, situation } = message;

  switch (situation) {
    case "exam":
    case "oneGoal":
      return words.bodies[situation][bodyVariant]?.(minutesLeft);
    case "partlyDone":
      return words.bodies.partlyDone[bodyVariant]?.(minutesLeft, minutesDone);
    case "severalGoals":
      return words.bodies.severalGoals[bodyVariant]?.(minutesLeft, otherGoals);
    default:
      return situation satisfies never;
  }
}

export function writeReminderText({
  message,
  words,
}: {
  message: ReminderMessage;
  words: ReminderWords;
}): ReminderText {
  return {
    body: getBody({ message, words }) ?? "",
    title: words.titles[message.titleVariant]?.(message.goalTitle) ?? message.goalTitle,
  };
}
